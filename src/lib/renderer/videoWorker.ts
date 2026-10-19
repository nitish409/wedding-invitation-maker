import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { dbStore } from '@/lib/db/store';
import {
  isServerlessEnvironment,
  objectStorage,
} from '@/lib/storage/objectStorage';
import {
  calculateWeddingScenes,
  getLocalizedCopy,
  getTemplateById,
} from '@/lib/video/sceneCalculator';
import {
  createRenderCanvas,
  preloadProjectImages,
  renderSingleVideoFrame,
} from '@/lib/renderer/frameRenderer';

let cachedFfmpegPromise: Promise<string> | null = null;

/**
 * Ensures an executable FFmpeg binary is available both locally and in serverless (/var/task / Vercel).
 * 1. Checks bundled ffmpeg-static paths.
 * 2. Ensures execute bit (+x) by copying to os.tmpdir() if needed.
 * 3. If the serverless bundler stripped the binary, automatically downloads & gunzips the official
 *    ffmpeg-static release binary into os.tmpdir()/ffmpeg-bin/ffmpeg and marks it executable (0o755).
 */
async function ensureFfmpegBinary(): Promise<string> {
  if (cachedFfmpegPromise) {
    const existing = await cachedFfmpegPromise;
    if (fs.existsSync(existing)) return existing;
    cachedFfmpegPromise = null;
  }

  cachedFfmpegPromise = (async () => {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const tmpBinDir = path.join(os.tmpdir(), 'shubhvivah-ffmpeg-bin');
    const tmpBinPath = path.join(tmpBinDir, `ffmpeg${ext}`);

    // If already prepared in os.tmpdir(), reuse immediately
    if (fs.existsSync(tmpBinPath)) {
      try {
        const stat = fs.statSync(tmpBinPath);
        if (stat.size > 1_000_000) {
          if (process.platform !== 'win32') {
            fs.chmodSync(tmpBinPath, 0o755);
          }
          return tmpBinPath;
        }
      } catch {
        // continue
      }
    }

    const candidates = [
      ffmpegStatic || '',
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`),
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      '/var/task/node_modules/ffmpeg-static/ffmpeg',
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          if (process.platform === 'win32') {
            return candidate;
          }
          // Test if candidate is directly executable
          try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
          } catch {
            // Copy to os.tmpdir() and chmod +x if /var/task removed execute permission
            fs.mkdirSync(tmpBinDir, { recursive: true });
            fs.copyFileSync(candidate, tmpBinPath);
            fs.chmodSync(tmpBinPath, 0o755);
            return tmpBinPath;
          }
        } catch {
          // try next candidate
        }
      }
    }

    // Fallback for serverless environments where the bundler stripped node_modules/ffmpeg-static/ffmpeg:
    // Download & gunzip the official ffmpeg-static binary into os.tmpdir()
    fs.mkdirSync(tmpBinDir, { recursive: true });
    const platform = process.platform;
    const arch = process.arch;
    const downloadUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-${platform}-${arch}.gz`;

    const res = await fetch(downloadUrl, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(
        `Failed to provision FFmpeg binary in serverless container (HTTP ${res.status})`
      );
    }
    const compressedBuf = Buffer.from(await res.arrayBuffer());
    const decompressedBuf = zlib.gunzipSync(compressedBuf);
    fs.writeFileSync(tmpBinPath, decompressedBuf);
    if (process.platform !== 'win32') {
      fs.chmodSync(tmpBinPath, 0o755);
    }
    return tmpBinPath;
  })();

  try {
    return await cachedFfmpegPromise;
  } catch (err) {
    cachedFfmpegPromise = null;
    throw err;
  }
}

/**
 * Generates a fallback royalty-free Indian classical WAV file inside os.tmpdir()
 * if the static audio asset is not found on disk.
 */
function writeFallbackWavToTemp(targetPath: string, durationSec: number = 24) {
  const sampleRate = 22050;
  const numChannels = 2;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t / 0.75);
    const phase = (t % 0.75) / 0.75;
    const freq = notes[beat % notes.length];
    const drone =
      0.15 * Math.sin(2 * Math.PI * 130.81 * t) +
      0.1 * Math.sin(2 * Math.PI * 196.0 * t);
    const melody =
      0.32 *
      Math.sin(Math.PI * phase) *
      (Math.sin(2 * Math.PI * freq * t) +
        0.35 * Math.sin(2 * Math.PI * freq * 2 * t));
    const sample = Math.max(-0.92, Math.min(0.92, drone + melody));
    const intVal = Math.floor(sample * 32767);
    const offset = 44 + i * 4;
    buffer.writeInt16LE(intVal, offset);
    buffer.writeInt16LE(intVal, offset + 2);
  }

  fs.writeFileSync(targetPath, buffer);
}

async function resolveAudioInputInTemp(
  musicUrl: string | undefined,
  tempWorkDir: string
): Promise<string> {
  // 0. Base64 data URL (used in stateless serverless mode when custom audio is uploaded)
  if (musicUrl && musicUrl.startsWith('data:audio/')) {
    const base64Part = musicUrl.split(',')[1];
    if (base64Part) {
      const ext = musicUrl.includes('audio/mpeg') || musicUrl.includes('audio/mp3') ? '.mp3' : '.wav';
      const tempAudioPath = path.join(tempWorkDir, `custom-inline-audio${ext}`);
      fs.writeFileSync(tempAudioPath, Buffer.from(base64Part, 'base64'));
      return tempAudioPath;
    }
  }

  // 1. Custom uploaded audio stored in objectStorage
  if (musicUrl && musicUrl.startsWith('/api/media/audio/')) {
    const fileName = path.basename(
      decodeURIComponent(musicUrl.replace('/api/media/audio/', '').split('?')[0])
    );
    const audioBuf = await objectStorage.downloadObject('audio', fileName);
    if (audioBuf && audioBuf.length > 0) {
      const tempAudioPath = path.join(tempWorkDir, fileName);
      fs.writeFileSync(tempAudioPath, audioBuf);
      return tempAudioPath;
    }
  }

  // 2. Remote HTTP/HTTPS audio URL
  if (
    musicUrl &&
    (musicUrl.startsWith('http://') || musicUrl.startsWith('https://'))
  ) {
    try {
      const res = await fetch(musicUrl);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const ext = musicUrl.toLowerCase().includes('.mp3') ? '.mp3' : '.wav';
        const tempAudioPath = path.join(tempWorkDir, `remote-audio${ext}`);
        fs.writeFileSync(tempAudioPath, Buffer.from(arr));
        return tempAudioPath;
      }
    } catch {
      // Fall through to local/fallback
    }
  }

  // 3. Static public audio asset (/audio/...)
  if (musicUrl && musicUrl.startsWith('/')) {
    const pubPath = path.join(process.cwd(), 'public', musicUrl.split('?')[0]);
    if (fs.existsSync(pubPath)) {
      return pubPath;
    }
  }

  const defaultPublicTrack = path.join(
    process.cwd(),
    'public',
    'audio',
    'royal-shehnai.wav'
  );
  if (fs.existsSync(defaultPublicTrack)) {
    return defaultPublicTrack;
  }

  // 4. Synthesize fallback WAV directly inside os.tmpdir() working directory
  const fallbackTempWav = path.join(tempWorkDir, 'royal-shehnai-fallback.wav');
  writeFallbackWavToTemp(fallbackTempWav, 24);
  return fallbackTempWav;
}

// Persistent in-process queue so multiple jobs process cleanly without colliding
const activeQueue: string[] = [];
let isWorkerRunning = false;

export function enqueueVideoRenderJob(jobId: string): Promise<void> {
  if (!activeQueue.includes(jobId)) {
    activeQueue.push(jobId);
  }
  return processNextJobInQueue();
}

async function processNextJobInQueue(): Promise<void> {
  if (isWorkerRunning) return;
  const nextJobId = activeQueue.shift();
  if (!nextJobId) return;

  isWorkerRunning = true;
  try {
    await executeRenderJob(nextJobId);
  } catch (err) {
    console.error('Worker unhandled error:', err);
  } finally {
    isWorkerRunning = false;
    if (activeQueue.length > 0) {
      await processNextJobInQueue();
    }
  }
}

export async function executeRenderJob(jobId: string): Promise<void> {
  const job = await dbStore.getRenderJobById(jobId);
  if (!job) return;
  if (job.status === 'completed') return;

  const project = await dbStore.getProjectById(job.projectId);
  if (!project) {
    await dbStore.updateRenderJob(jobId, {
      status: 'failed',
      errorMessage: 'Associated wedding project was not found.',
      stageMessage: 'Render failed: Project missing',
    });
    return;
  }

  const settings = await dbStore.getSettings();
  const width = settings.resolutionWidth || 1080;
  const height = settings.resolutionHeight || 1920;
  const outputFps = settings.fps || 30;
  // Use 6 unique animated frames/sec in serverless for fast completion (~5s) within Vercel limits,
  // or 15 unique frames/sec on dedicated servers; FFmpeg duplicates cleanly to 30 FPS H.264 output.
  const renderFps = isServerlessEnvironment() ? 6 : 15;

  // Create isolated temporary working directory in os.tmpdir() with { recursive: true }
  const tempWorkDir = objectStorage.createTempWorkingDir(`job-${job.id}`);

  try {
    await dbStore.updateRenderJob(jobId, {
      status: 'processing',
      progress: 8,
      stageMessage: 'Loading couple portraits & preparing video encoder...',
      errorMessage: undefined,
    });

    const ffmpegBin = await ensureFfmpegBinary();

    const templates = await dbStore.listTemplates(true);
    const template = getTemplateById(project.templateId, templates);
    const copy = getLocalizedCopy(project.language);
    const { scenes, totalDurationSec, totalFrames } = calculateWeddingScenes(
      project,
      renderFps
    );

    const images = await preloadProjectImages(project);

    await dbStore.updateRenderJob(jobId, {
      progress: 16,
      stageMessage: `Preparing ${scenes.length} animated wedding scenes (${totalDurationSec}s)...`,
    });

    const audioFilePath = await resolveAudioInputInTemp(
      project.music?.url,
      tempWorkDir
    );
    const startOffsetSec = Math.max(0, project.music?.startOffsetSec || 0);
    const volume = Math.max(0, Math.min(1, project.music?.volume ?? 0.85));
    const fadeOutStart = Math.max(2, totalDurationSec - 2.5);

    const tempMp4Path = path.join(tempWorkDir, `invitation-${job.id}.tmp.mp4`);
    const outputObjectKey = `invitation-${job.id}.mp4`;

    // Audio filter chain: volume + 2s fade-in + 2.5s fade-out
    const audioFilter = `volume=${volume.toFixed(
      2
    )},afade=t=in:st=0:d=2.0,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2.5`;

    const ffmpegArgs = [
      '-y',
      // Input 0: Raw RGBA video frames from Canvas
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-r',
      String(renderFps),
      '-i',
      'pipe:0',
      // Input 1: Audio file with loop and start offset
      '-stream_loop',
      '-1',
      '-ss',
      String(startOffsetSec),
      '-i',
      audioFilePath,
      // Map video & audio
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      // Video encoding: H.264 1080x1920 @ 30fps
      '-c:v',
      'libx264',
      '-preset',
      isServerlessEnvironment() ? 'veryfast' : 'ultrafast',
      '-crf',
      isServerlessEnvironment() ? '28' : '22',
      ...(isServerlessEnvironment()
        ? ['-maxrate', '420k', '-bufsize', '840k']
        : []),
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(outputFps),
      // Audio encoding: AAC Stereo
      '-af',
      audioFilter,
      '-c:a',
      'aac',
      '-b:a',
      isServerlessEnvironment() ? '96k' : '192k',
      '-ar',
      '44100',
      '-ac',
      '2',
      // Trim to exact video duration & optimize MP4 header for WhatsApp/Mobile streaming
      '-t',
      String(totalDurationSec),
      '-movflags',
      '+faststart',
      tempMp4Path,
    ];

    const canvas = createRenderCanvas(width, height);
    const ctx = canvas.getContext('2d');

    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegBin, ffmpegArgs, {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let stderrLog = '';
      ff.stderr.on('data', (chunk) => {
        stderrLog += chunk.toString();
        if (stderrLog.length > 4000) {
          stderrLog = stderrLog.slice(-4000);
        }
      });

      ff.on('error', (err) => {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });

      ff.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempMp4Path)) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg exited with code ${code}. Details: ${stderrLog.slice(-400)}`
            )
          );
        }
      });

      let frameIndex = 0;

      const writeNextFrame = () => {
        try {
          while (frameIndex < totalFrames) {
            renderSingleVideoFrame(
              ctx,
              width,
              height,
              frameIndex,
              renderFps,
              project,
              template,
              scenes,
              copy,
              images
            );

            const rawBuffer = canvas.data();
            frameIndex++;

            // Update progress periodically
            if (frameIndex % 20 === 0 || frameIndex === totalFrames) {
              const pct = Math.min(
                94,
                Math.round(16 + (frameIndex / totalFrames) * 78)
              );
              const activeScene =
                scenes.find(
                  (s) =>
                    frameIndex >= s.startFrame &&
                    frameIndex < s.startFrame + s.durationFrames
                ) || scenes[scenes.length - 1];

              void dbStore.updateRenderJob(jobId, {
                progress: pct,
                stageMessage: `Rendering Scene: ${activeScene.title} (${Math.round(
                  (frameIndex / totalFrames) * 100
                )}%)`,
              });
            }

            const canContinue = ff.stdin.write(rawBuffer);
            if (!canContinue) {
              ff.stdin.once('drain', writeNextFrame);
              return;
            }
          }

          void dbStore.updateRenderJob(jobId, {
            progress: 96,
            stageMessage:
              'Uploading rendered HD MP4 to persistent object storage...',
          });
          ff.stdin.end();
        } catch (frameErr) {
          ff.kill('SIGKILL');
          reject(frameErr);
        }
      };

      writeNextFrame();
    });

    // Read the rendered MP4 from os.tmpdir() and upload to persistent storage (Supabase Storage / local persistent store)
    const mp4Buffer = fs.readFileSync(tempMp4Path);
    const uploaded = await objectStorage.uploadObject(
      'renders',
      outputObjectKey,
      mp4Buffer,
      'video/mp4'
    );

    await dbStore.updateRenderJob(jobId, {
      status: 'completed',
      progress: 100,
      stageMessage: 'Your Wedding Invitation Video is Ready!',
      outputPath: uploaded.storageKey,
      outputSizeBytes: uploaded.sizeBytes,
      durationSec: totalDurationSec,
      completedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error
        ? error.message
        : 'Unexpected error during video rendering';
    console.error(`Render job ${jobId} failed:`, errMsg);

    const currentJob = await dbStore.getRenderJobById(jobId);
    if (
      currentJob &&
      currentJob.attempts < 2 &&
      !project.brideName.includes('__FORCE_FAIL__')
    ) {
      await dbStore.updateRenderJob(jobId, {
        status: 'queued',
        attempts: currentJob.attempts + 1,
        progress: 5,
        stageMessage: 'Retrying video render automatically (Attempt 2)...',
      });
      await executeRenderJob(jobId);
      return;
    }

    await dbStore.updateRenderJob(jobId, {
      status: 'failed',
      stageMessage: 'Video generation encountered an error.',
      errorMessage: errMsg,
    });
  } finally {
    // Always clean up temporary files in os.tmpdir() after processing
    objectStorage.cleanupTempWorkingDir(tempWorkDir);
  }
}

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { dbStore, STORAGE_DIRS } from '@/lib/db/store';
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

function resolveFfmpegPath(): string {
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }
  const winFallback = path.join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    'ffmpeg.exe'
  );
  if (fs.existsSync(winFallback)) return winFallback;
  const nixFallback = path.join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    'ffmpeg'
  );
  if (fs.existsSync(nixFallback)) return nixFallback;
  return 'ffmpeg';
}

function resolveAudioFilePath(musicUrl?: string): string {
  const defaultTrack = path.join(
    process.cwd(),
    'public',
    'audio',
    'royal-shehnai.wav'
  );
  if (!musicUrl) return defaultTrack;

  if (musicUrl.startsWith('/api/media/audio/')) {
    const fileName = decodeURIComponent(
      musicUrl.replace('/api/media/audio/', '').split('?')[0]
    );
    const uploadedPath = path.join(
      STORAGE_DIRS.audio,
      path.basename(fileName)
    );
    if (fs.existsSync(uploadedPath)) return uploadedPath;
  }

  if (musicUrl.startsWith('/')) {
    const pubPath = path.join(process.cwd(), 'public', musicUrl.split('?')[0]);
    if (fs.existsSync(pubPath)) return pubPath;
  }

  return defaultTrack;
}

// Persistent in-process queue so multiple jobs process cleanly without colliding
const activeQueue: string[] = [];
let isWorkerRunning = false;

export function enqueueVideoRenderJob(jobId: string) {
  if (!activeQueue.includes(jobId)) {
    activeQueue.push(jobId);
  }
  if (!isWorkerRunning) {
    void processNextJobInQueue();
  }
}

async function processNextJobInQueue() {
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
      void processNextJobInQueue();
    }
  }
}

async function executeRenderJob(jobId: string) {
  const job = dbStore.getRenderJobById(jobId);
  if (!job) return;

  const project = dbStore.getProjectById(job.projectId);
  if (!project) {
    dbStore.updateRenderJob(jobId, {
      status: 'failed',
      errorMessage: 'Associated wedding project was not found.',
      stageMessage: 'Render failed: Project missing',
    });
    return;
  }

  const settings = dbStore.getSettings();
  const width = settings.resolutionWidth || 1080;
  const height = settings.resolutionHeight || 1920;
  const outputFps = settings.fps || 30;
  // Render 15 unique animated frames per second and duplicate to 30fps in H.264 encoder for fast HD generation
  const renderFps = 15;

  try {
    dbStore.updateRenderJob(jobId, {
      status: 'processing',
      progress: 6,
      stageMessage: 'Loading couple portraits & template artwork...',
      errorMessage: undefined,
    });

    const templates = dbStore.listTemplates(true);
    const template = getTemplateById(project.templateId, templates);
    const copy = getLocalizedCopy(project.language);
    const { scenes, totalDurationSec, totalFrames } = calculateWeddingScenes(
      project,
      renderFps
    );

    const images = await preloadProjectImages(project);

    dbStore.updateRenderJob(jobId, {
      progress: 14,
      stageMessage: `Preparing ${scenes.length} animated wedding scenes (${totalDurationSec}s)...`,
    });

    const audioFilePath = resolveAudioFilePath(project.music?.url);
    const startOffsetSec = Math.max(0, project.music?.startOffsetSec || 0);
    const volume = Math.max(0, Math.min(1, project.music?.volume ?? 0.85));
    const fadeOutStart = Math.max(2, totalDurationSec - 2.5);

    fs.mkdirSync(STORAGE_DIRS.renders, { recursive: true });
    const finalMp4Path = path.join(
      STORAGE_DIRS.renders,
      `invitation-${job.id}.mp4`
    );
    const tempMp4Path = path.join(
      STORAGE_DIRS.renders,
      `invitation-${job.id}.tmp.mp4`
    );

    if (fs.existsSync(tempMp4Path)) {
      fs.unlinkSync(tempMp4Path);
    }

    const ffmpegBin = resolveFfmpegPath();

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
      'ultrafast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(outputFps),
      // Audio encoding: AAC 192kbps Stereo
      '-af',
      audioFilter,
      '-c:a',
      'aac',
      '-b:a',
      '192k',
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
            if (frameIndex % 15 === 0 || frameIndex === totalFrames) {
              const pct = Math.min(
                96,
                Math.round(15 + (frameIndex / totalFrames) * 80)
              );
              const activeScene =
                scenes.find(
                  (s) =>
                    frameIndex >= s.startFrame &&
                    frameIndex < s.startFrame + s.durationFrames
                ) || scenes[scenes.length - 1];

              dbStore.updateRenderJob(jobId, {
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

          dbStore.updateRenderJob(jobId, {
            progress: 98,
            stageMessage: 'Muxing AAC audio & finalizing H.264 MP4 stream...',
          });
          ff.stdin.end();
        } catch (frameErr) {
          ff.kill('SIGKILL');
          reject(frameErr);
        }
      };

      writeNextFrame();
    });

    if (fs.existsSync(finalMp4Path)) {
      fs.unlinkSync(finalMp4Path);
    }
    fs.renameSync(tempMp4Path, finalMp4Path);
    const stat = fs.statSync(finalMp4Path);

    dbStore.updateRenderJob(jobId, {
      status: 'completed',
      progress: 100,
      stageMessage: 'Your Wedding Invitation Video is Ready!',
      outputPath: finalMp4Path,
      outputSizeBytes: stat.size,
      durationSec: totalDurationSec,
      completedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error
        ? error.message
        : 'Unexpected error during video rendering';
    console.error(`Render job ${jobId} failed:`, errMsg);

    // Automatic single retry if first attempt failed transiently
    const currentJob = dbStore.getRenderJobById(jobId);
    if (currentJob && currentJob.attempts < 2 && !project.brideName.includes('__FORCE_FAIL__')) {
      dbStore.updateRenderJob(jobId, {
        status: 'queued',
        attempts: currentJob.attempts + 1,
        progress: 5,
        stageMessage: 'Retrying video render automatically (Attempt 2)...',
      });
      enqueueVideoRenderJob(jobId);
      return;
    }

    dbStore.updateRenderJob(jobId, {
      status: 'failed',
      stageMessage: 'Video generation encountered an error.',
      errorMessage: errMsg,
    });
  }
}

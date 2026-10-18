import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
const SAMPLES_DIR = path.join(PUBLIC_DIR, 'samples');

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(SAMPLES_DIR, { recursive: true });

/**
 * Generates a 16-bit PCM Stereo WAV file with rich Indian classical/folk synthesis
 */
function writeWavFile(filePath, durationSec, synthesizerFn) {
  const sampleRate = 22050; // Fast generation, clear crisp harmonics, FFmpeg upsamples to 44.1kHz AAC
  const numChannels = 2;
  const numSamples = Math.floor(sampleRate * durationSec);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // Linear PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = synthesizerFn(t, durationSec);
    const clampL = Math.max(-0.95, Math.min(0.95, left));
    const clampR = Math.max(-0.95, Math.min(0.95, right));
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.floor(clampL * 32767), offset);
    buffer.writeInt16LE(Math.floor(clampR * 32767), offset + 2);
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`Generated audio track: ${path.basename(filePath)} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

// Raga Yaman / Desh frequencies (in Hz, Sa = C4 = 261.63)
const SA = 261.63;
const RE = 293.66;
const GA = 329.63;
const MA = 370.0; // Tivra Ma for Yaman
const PA = 392.0;
const DHA = 440.0;
const NI = 493.88;
const SA_HIGH = 523.25;
const RE_HIGH = 587.33;

function generateAudioAssets() {
  const duration = 68;

  // 1. Royal Shehnai & Santoor Mangalam
  const royalMelody = [SA, RE, GA, PA, GA, RE, SA, NI / 2, SA, GA, PA, DHA, SA_HIGH, NI, DHA, PA];
  writeWavFile(path.join(AUDIO_DIR, 'royal-shehnai.wav'), duration, (t) => {
    // Tanpura drone (Sa + Pa)
    const drone =
      0.14 * Math.sin(2 * Math.PI * (SA / 2) * t) +
      0.1 * Math.sin(2 * Math.PI * (PA / 2) * t) +
      0.05 * Math.sin(2 * Math.PI * SA * t);

    // Melody note selection with vibrato (Shehnai style)
    const beatLen = 0.85;
    const step = Math.floor(t / beatLen);
    const notePhase = (t % beatLen) / beatLen;
    const freq = royalMelody[step % royalMelody.length];
    const vibrato = 1 + 0.008 * Math.sin(2 * Math.PI * 5.5 * t);
    const env = Math.sin(Math.PI * notePhase) * (1 - 0.25 * notePhase);

    const shehnai =
      env *
      (0.26 * Math.sin(2 * Math.PI * freq * vibrato * t) +
        0.16 * Math.sin(2 * Math.PI * freq * 2 * vibrato * t) +
        0.08 * Math.sin(2 * Math.PI * freq * 3 * vibrato * t));

    // Santoor arpeggio shimmer
    const arpStep = Math.floor(t / (beatLen / 4));
    const arpPhase = (t % (beatLen / 4)) / (beatLen / 4);
    const arpFreq = royalMelody[(arpStep * 3) % royalMelody.length] * 2;
    const santoor = 0.14 * Math.exp(-5 * arpPhase) * Math.sin(2 * Math.PI * arpFreq * t);

    // Soft tabla pulse
    const tablaPhase = (t % (beatLen / 2)) / (beatLen / 2);
    const tabla = 0.16 * Math.exp(-12 * tablaPhase) * Math.sin(2 * Math.PI * (110 - 30 * tablaPhase) * t);

    const mixL = drone + shehnai * 0.9 + santoor * 1.1 + tabla;
    const mixR = drone + shehnai * 1.1 + santoor * 0.8 + tabla;
    return [mixL, mixR];
  });

  // 2. Floral Sitar & Bansuri Romance
  const floralMelody = [GA, PA, DHA, SA_HIGH, RE_HIGH, SA_HIGH, DHA, PA, GA, RE, SA, RE, GA, PA, GA, SA];
  writeWavFile(path.join(AUDIO_DIR, 'floral-sitar.wav'), duration, (t) => {
    const beatLen = 0.95;
    const step = Math.floor(t / beatLen);
    const notePhase = (t % beatLen) / beatLen;
    const freq = floralMelody[step % floralMelody.length];

    // Warm pad / drone
    const pad =
      0.15 * Math.sin(2 * Math.PI * (SA / 2) * t) +
      0.12 * Math.sin(2 * Math.PI * (GA / 2) * t) +
      0.1 * Math.sin(2 * Math.PI * (PA / 2) * t);

    // Bansuri breathy flute
    const fluteEnv = Math.sin(Math.PI * notePhase);
    const vibrato = 1 + 0.006 * Math.sin(2 * Math.PI * 4.8 * t);
    const flute =
      fluteEnv *
      (0.32 * Math.sin(2 * Math.PI * freq * vibrato * t) +
        0.09 * Math.sin(2 * Math.PI * freq * 2 * vibrato * t));

    // Sitar pluck
    const pluckPhase = (t % (beatLen / 2)) / (beatLen / 2);
    const sitarFreq = floralMelody[(step + 2) % floralMelody.length];
    const sitar =
      0.22 *
      Math.exp(-4.2 * pluckPhase) *
      (Math.sin(2 * Math.PI * sitarFreq * t) + 0.4 * Math.sin(2 * Math.PI * sitarFreq * 2 * t));

    return [pad + flute * 1.05 + sitar * 0.85, pad + flute * 0.85 + sitar * 1.05];
  });

  // 3. Haldi & Mehndi Festive Dhol & Tumbi
  const haldiMelody = [SA, GA, PA, DHA, PA, GA, RE, SA, PA, DHA, SA_HIGH, DHA, PA, GA, RE, SA];
  writeWavFile(path.join(AUDIO_DIR, 'haldi-dhol.wav'), duration, (t) => {
    const beatLen = 0.48; // Upbeat festive tempo (125 BPM)
    const step = Math.floor(t / beatLen);
    const beatPhase = (t % beatLen) / beatLen;
    const freq = haldiMelody[step % haldiMelody.length];

    // Festive Dhol bass & chak
    const isBassHit = step % 2 === 0;
    const dholBass = isBassHit
      ? 0.38 * Math.exp(-9 * beatPhase) * Math.sin(2 * Math.PI * (95 - 35 * beatPhase) * t)
      : 0.25 * Math.exp(-14 * beatPhase) * Math.sin(2 * Math.PI * 240 * t);

    // Tumbi / Folk pluck
    const tumbi =
      0.28 *
      Math.exp(-3.5 * beatPhase) *
      (Math.sin(2 * Math.PI * freq * t) +
        0.5 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.25 * Math.sin(2 * Math.PI * freq * 3 * t));

    // Drone
    const drone = 0.1 * Math.sin(2 * Math.PI * SA * t);

    return [dholBass + tumbi + drone, dholBass * 0.95 + tumbi * 1.05 + drone];
  });

  // 4. Sacred Mandap Veena & Temple Chimes
  const templeMelody = [SA, RE, GA, MA, PA, DHA, NI, SA_HIGH, NI, DHA, PA, MA, GA, RE, SA, PA / 2];
  writeWavFile(path.join(AUDIO_DIR, 'temple-veena.wav'), duration, (t) => {
    const beatLen = 1.05;
    const step = Math.floor(t / beatLen);
    const phase = (t % beatLen) / beatLen;
    const freq = templeMelody[step % templeMelody.length];

    // Vedic Tanpura
    const tanpura =
      0.16 * Math.sin(2 * Math.PI * (SA / 2) * t) +
      0.12 * Math.sin(2 * Math.PI * (PA / 2) * t) +
      0.07 * Math.sin(2 * Math.PI * SA * t);

    // Veena resonant string
    const veena =
      0.3 *
      Math.exp(-2.8 * phase) *
      (Math.sin(2 * Math.PI * freq * t) +
        0.35 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.15 * Math.sin(2 * Math.PI * freq * 3 * t));

    // Temple bell chime every 4 beats
    const bellCycle = t % (beatLen * 4);
    const bell =
      0.18 *
      Math.exp(-1.8 * bellCycle) *
      (Math.sin(2 * Math.PI * SA_HIGH * 2 * t) + 0.5 * Math.sin(2 * Math.PI * PA * 4 * t));

    return [tanpura + veena + bell * 0.9, tanpura + veena * 0.95 + bell * 1.1];
  });
}

function drawOrnamentalBorder(ctx, w, h, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  ctx.restore();
}

function generateSamplePhotos() {
  // 1. Bride Sample Portrait (800x1000)
  {
    const w = 800;
    const h = 1000;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(w / 2, h * 0.4, 60, w / 2, h / 2, 650);
    grad.addColorStop(0, '#881337');
    grad.addColorStop(0.6, '#4C0519');
    grad.addColorStop(1, '#1F030B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Golden halo mandala behind bride
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.lineWidth = 2;
    for (let r = 140; r <= 280; r += 35) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a * Math.PI * 2) / 24;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 120, Math.sin(ang) * 120);
      ctx.lineTo(Math.cos(ang) * 280, Math.sin(ang) * 280);
      ctx.stroke();
    }
    ctx.restore();

    // Bridal Dupatta / Veil silhouette
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.56, 230, 340, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Shoulders / Royal Lehenga Choli
    const lehengaGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
    lehengaGrad.addColorStop(0, '#BE123C');
    lehengaGrad.addColorStop(1, '#881337');
    ctx.fillStyle = lehengaGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h);
    ctx.quadraticCurveTo(w / 2, h * 0.56, w * 0.8, h);
    ctx.closePath();
    ctx.fill();

    // Golden Kundan Necklace
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.57, 78, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Neck & Face
    ctx.fillStyle = '#F3C6A5';
    ctx.fillRect(w / 2 - 28, h * 0.5, 56, 75);
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.41, 95, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair & Maang Tikka
    ctx.fillStyle = '#1E1B18';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.38, 102, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();

    // Maang Tikka & Bindi
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.34, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.38, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & Smile
    ctx.strokeStyle = '#291711';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(w / 2 - 34, h * 0.41, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2 + 34, h * 0.41, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.46, 22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Nath (Bridal nose ring)
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(w / 2 - 18, h * 0.445, 18, 0, Math.PI * 1.5);
    ctx.stroke();

    drawOrnamentalBorder(ctx, w, h, '#D4AF37');
    fs.writeFileSync(path.join(SAMPLES_DIR, 'bride-sample.png'), canvas.toBuffer('image/png'));
  }

  // 2. Groom Sample Portrait (800x1000)
  {
    const w = 800;
    const h = 1000;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(w / 2, h * 0.4, 60, w / 2, h / 2, 650);
    grad.addColorStop(0, '#5C0A1B');
    grad.addColorStop(0.65, '#2E050E');
    grad.addColorStop(1, '#140206');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Golden aura
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 2;
    for (let r = 150; r <= 270; r += 40) {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ivory & Gold Royal Sherwani
    ctx.fillStyle = '#FDF6EC';
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h);
    ctx.quadraticCurveTo(w / 2, h * 0.54, w * 0.82, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Emerald & Pearl Haar (Mala)
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.58, 90, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Neck & Face
    ctx.fillStyle = '#EAB692';
    ctx.fillRect(w / 2 - 32, h * 0.5, 64, 80);
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.42, 96, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // Royal Maroon Safa (Turban) with Kalgi
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.31, 118, 68, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Kalgi brooch on turban
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(w / 2 + 25, h * 0.29, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & Gentle Smile
    ctx.strokeStyle = '#1E1B18';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2 - 35, h * 0.41, 15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2 + 35, h * 0.41, 15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.47, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    drawOrnamentalBorder(ctx, w, h, '#D4AF37');
    fs.writeFileSync(path.join(SAMPLES_DIR, 'groom-sample.png'), canvas.toBuffer('image/png'));
  }

  // 3. Couple Sample Portrait (800x1000)
  {
    const w = 800;
    const h = 1000;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4A0715');
    grad.addColorStop(0.5, '#7A1128');
    grad.addColorStop(1, '#2D040D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Golden Mandap Arch
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.45, 290, Math.PI, 0);
    ctx.lineTo(w / 2 + 290, h * 0.92);
    ctx.moveTo(w / 2 - 290, h * 0.45);
    ctx.lineTo(w / 2 - 290, h * 0.92);
    ctx.stroke();

    // Groom (Left)
    ctx.fillStyle = '#FDF6EC';
    ctx.beginPath();
    ctx.ellipse(w * 0.39, h * 0.78, 125, 220, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#EAB692';
    ctx.beginPath();
    ctx.ellipse(w * 0.39, h * 0.47, 74, 92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.ellipse(w * 0.39, h * 0.38, 86, 48, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // Bride (Right)
    ctx.fillStyle = '#BE123C';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.8, 130, 210, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#F3C6A5';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.5, 70, 86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#881337';
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.48, 76, Math.PI, 0);
    ctx.fill();

    // Varmala garlands
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(w * 0.39, h * 0.61, 55, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.63, 52, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    drawOrnamentalBorder(ctx, w, h, '#D4AF37');
    fs.writeFileSync(path.join(SAMPLES_DIR, 'couple-sample.png'), canvas.toBuffer('image/png'));
  }

  // 4. Palace Sample Photo (800x1000)
  {
    const w = 800;
    const h = 1000;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1E1B4B');
    sky.addColorStop(0.55, '#7C2D12');
    sky.addColorStop(1, '#451A03');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Palace Domes & Arches
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 95, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.27, h * 0.48, 60, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.73, h * 0.48, 60, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#B45309';
    ctx.fillRect(w * 0.16, h * 0.48, w * 0.68, h * 0.32);

    // Glowing arches
    ctx.fillStyle = '#FEF08A';
    for (let i = 0; i < 5; i++) {
      const ax = w * 0.23 + i * 110;
      ctx.beginPath();
      ctx.arc(ax, h * 0.64, 32, Math.PI, 0);
      ctx.lineTo(ax + 32, h * 0.76);
      ctx.lineTo(ax - 32, h * 0.76);
      ctx.closePath();
      ctx.fill();
    }

    drawOrnamentalBorder(ctx, w, h, '#D4AF37');
    fs.writeFileSync(path.join(SAMPLES_DIR, 'palace-sample.png'), canvas.toBuffer('image/png'));
  }

  console.log('Generated 4 sample wedding portraits in public/samples/');
}

generateAudioAssets();
generateSamplePhotos();

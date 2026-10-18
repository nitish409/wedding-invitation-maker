import fs from 'fs';
import path from 'path';
import { createCanvas, Image, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import {
  ComputedScene,
  PhotoSlotConfig,
  TemplateDefinition,
  WeddingProject,
} from '@/types/wedding';
import {
  formatReadableDate,
  LocalizedLabels,
} from '@/lib/video/sceneCalculator';
import { STORAGE_DIRS } from '@/lib/db/store';

export interface LoadedProjectImages {
  bride?: Image;
  groom?: Image;
  couple?: Image;
  gallery?: Image;
}

function parseDateParts(dateStr: string) {
  const d = new Date(dateStr || '2026-11-21');
  if (isNaN(d.getTime())) {
    return {
      weekday: 'Saturday',
      day: '21',
      monthUpper: 'NOVEMBER',
      monthShort: 'NOV',
      year: '2026',
    };
  }
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    day: String(d.getDate()),
    monthUpper: d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase(),
    monthShort: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    year: String(d.getFullYear()),
  };
}

async function resolveAndLoadImage(url?: string): Promise<Image | undefined> {
  if (!url) return undefined;
  try {
    if (url.startsWith('/api/media/photo/')) {
      const fileName = decodeURIComponent(
        url.replace('/api/media/photo/', '').split('?')[0]
      );
      const fullPath = path.join(STORAGE_DIRS.photos, path.basename(fileName));
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        return await loadImage(buf);
      }
    }
    if (url.startsWith('/')) {
      const publicPath = path.join(process.cwd(), 'public', url.split('?')[0]);
      if (fs.existsSync(publicPath)) {
        const buf = fs.readFileSync(publicPath);
        return await loadImage(buf);
      }
    }
    if (url.startsWith('data:image/')) {
      return await loadImage(url);
    }
    const fallback = path.join(
      process.cwd(),
      'public',
      'samples',
      'couple-sample.png'
    );
    if (fs.existsSync(fallback)) {
      return await loadImage(fs.readFileSync(fallback));
    }
  } catch {
    // ignore load failure
  }
  return undefined;
}

export async function preloadProjectImages(
  project: WeddingProject
): Promise<LoadedProjectImages> {
  const [bride, groom, couple, gallery] = await Promise.all([
    resolveAndLoadImage(project.photos?.bride?.url),
    resolveAndLoadImage(project.photos?.groom?.url),
    resolveAndLoadImage(project.photos?.couple?.url),
    resolveAndLoadImage(project.photos?.gallery?.url),
  ]);
  return { bride, groom, couple, gallery };
}

function wrapTextLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 4
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

function drawCroppedPhoto(
  ctx: SKRSContext2D,
  img: Image | undefined,
  slot: PhotoSlotConfig | undefined,
  cx: number,
  cy: number,
  size: number,
  borderColor: string,
  accentColor: string,
  arch: boolean = false
) {
  const w = size;
  const h = arch ? Math.round(size * 1.15) : size;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.save();
  ctx.beginPath();
  if (arch) {
    const r = w / 2;
    ctx.arc(cx, y + r, r, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h - 28);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 28, y + h);
    ctx.lineTo(x + 28, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 28);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
  }

  ctx.fillStyle = '#2A0810';
  ctx.fill();
  ctx.clip();

  if (img && img.width > 0 && img.height > 0) {
    const zoom = Math.max(0.8, Math.min(3, slot?.zoom || 1));
    const offsetX = slot?.offsetX || 0;
    const offsetY = slot?.offsetY || 0;

    // Aspect-ratio preserving object-fit: cover math (prevents stretched faces!)
    const imgAspect = img.width / img.height;
    const boxAspect = w / h;
    let drawW = w;
    let drawH = h;
    if (imgAspect > boxAspect) {
      drawH = h;
      drawW = h * imgAspect;
    } else {
      drawW = w;
      drawH = w / imgAspect;
    }

    drawW *= zoom;
    drawH *= zoom;

    const panX = (offsetX / 100) * (w * 0.45);
    const panY = (offsetY / 100) * (h * 0.45);

    const dx = cx - drawW / 2 + panX;
    const dy = cy - drawH / 2 + panY;

    ctx.drawImage(img, dx, dy, drawW, drawH);

    if (slot?.removeBg) {
      const vig = ctx.createRadialGradient(cx, cy, w * 0.28, cx, cy, w * 0.54);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, borderColor);
      ctx.fillStyle = vig;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.restore();

  // Outer Royal Border
  ctx.save();
  ctx.beginPath();
  if (arch) {
    const r = w / 2;
    ctx.arc(cx, y + r, r, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h - 28);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 28, y + h);
    ctx.lineTo(x + 28, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 28);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
  }
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.restore();
}

function drawGaneshMotif(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  const scale = radius / 140;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 135, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 114, 0, Math.PI * 2);
  ctx.stroke();

  // Mukut (Crown)
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-40, -35);
  ctx.lineTo(0, -92);
  ctx.lineTo(40, -35);
  ctx.closePath();
  ctx.stroke();

  // Trunk & Curved Vakratunda silhouette
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, -26);
  ctx.bezierCurveTo(-34, -50, 34, -50, 34, -26);
  ctx.bezierCurveTo(34, 8, 12, 30, 4, 54);
  ctx.bezierCurveTo(-4, 76, 22, 86, 32, 70);
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.moveTo(-38, -18);
  ctx.bezierCurveTo(-84, -28, -84, 34, -38, 26);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(38, -18);
  ctx.bezierCurveTo(84, -28, 84, 34, 38, 26);
  ctx.stroke();

  // Sacred Tilak
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(16, -18);
  ctx.moveTo(-12, -8);
  ctx.lineTo(12, -8);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 4, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPeacockMotif(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  flip: boolean = false
) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);

  // Emerald tail feathers
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.moveTo(-10, 10);
  ctx.bezierCurveTo(-55, 35, -75, 85, -80, 125);
  ctx.bezierCurveTo(-40, 115, -10, 75, 5, 20);
  ctx.closePath();
  ctx.fill();

  // Gold & sapphire eye spots on feathers
  for (const [ex, ey] of [
    [-48, 85],
    [-32, 62],
    [-55, 104],
  ]) {
    ctx.fillStyle = '#D4AF37';
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Royal Blue Peacock Body & Neck
  ctx.fillStyle = '#1E40AF';
  ctx.beginPath();
  ctx.ellipse(6, 0, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(16, -36, 12, 0, Math.PI * 2);
  ctx.fill();

  // Golden Beak
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(26, -40);
  ctx.lineTo(40, -35);
  ctx.lineTo(26, -30);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawTempleBellOnGarland(
  ctx: SKRSContext2D,
  x: number,
  topY: number,
  length: number,
  swingRad: number
) {
  ctx.save();
  ctx.translate(x, topY);
  ctx.rotate(swingRad);

  const count = Math.max(2, Math.floor((length - 45) / 28));
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#FACC15' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 14 + i * 28, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  const bellTop = 14 + count * 28;
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.moveTo(-14, bellTop);
  ctx.lineTo(14, bellTop);
  ctx.lineTo(24, bellTop + 32);
  ctx.lineTo(-24, bellTop + 32);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.arc(0, bellTop + 36, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHaldiPaperWheel(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  radius: number,
  angleRad: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);

  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  const spokes = 24;
  for (let i = 0; i < spokes; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / spokes);
    ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-radius * 0.1, -radius);
    ctx.lineTo(radius * 0.1, -radius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTemplateDecorations(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  frame: number,
  template: TemplateDefinition,
  isHaldiLook: boolean
) {
  // 1. Rotating Center Mandala
  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  ctx.rotate((frame * 0.0045) % (Math.PI * 2));
  ctx.strokeStyle = isHaldiLook ? '#D97706' : template.secondaryColor;
  ctx.globalAlpha = 0.13;
  ctx.lineWidth = 2;

  for (const r of [440, 360, 270, 180]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 16);
    ctx.beginPath();
    ctx.ellipse(0, -310, 26, 95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // 2. Top Header Decorations (Haldi Pinwheels OR Swinging Temple Bells on Arch)
  if (isHaldiLook) {
    drawHaldiPaperWheel(ctx, 45, 45, 115, frame * 0.01);
    drawHaldiPaperWheel(ctx, 355, 20, 155, -frame * 0.008);
    drawHaldiPaperWheel(ctx, w - 45, 50, 110, frame * 0.01);
    drawHaldiPaperWheel(ctx, w - 25, 680, 115, -frame * 0.01);
  } else {
    // Cusped Palace Arch + Hanging Brass Temple Bells (Ghanti)
    ctx.save();
    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, 250);
    ctx.quadraticCurveTo(220, 90, w / 2, 34);
    ctx.quadraticCurveTo(w - 220, 90, w - 40, 250);
    ctx.stroke();
    ctx.restore();

    drawTempleBellOnGarland(
      ctx,
      410,
      58,
      140,
      Math.sin(frame * 0.08) * 0.09
    );
    drawTempleBellOnGarland(
      ctx,
      w / 2,
      38,
      175,
      Math.sin(frame * 0.08 + 1.2) * 0.1
    );
    drawTempleBellOnGarland(
      ctx,
      w - 410,
      58,
      140,
      Math.sin(frame * 0.08 + 2.4) * 0.09
    );
  }

  // 3. Vintage Heritage Street Lamps for Floral Arch Template (Reference Screenshot 1)
  if (template.motifStyle === 'floral-arch' && !isHaldiLook) {
    for (const lampX of [88, w - 88]) {
      ctx.save();
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(lampX - 10, 420, 20, 1180);
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(lampX - 36, 420);
      ctx.lineTo(lampX + 36, 420);
      ctx.lineTo(lampX + 48, 330);
      ctx.lineTo(lampX - 48, 330);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Falling Petals / Golden Particles
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const seed = (i + 1) * 53;
    const baseX = ((seed * 41) % (w - 140)) + 70;
    const speed = 3.6 + (i % 4) * 1.3;
    const y = ((frame * speed + seed * 23) % (h + 60)) - 30;
    const drift = Math.sin(frame * 0.05 + i) * 24;

    ctx.fillStyle = isHaldiLook
      ? i % 2 === 0
        ? '#F59E0B'
        : '#FACC15'
      : template.motifStyle === 'floral-arch'
      ? '#F472B6'
      : template.secondaryColor;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(baseX + drift, y, 7, 11, frame * 0.03 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 5. Double Royal Border
  ctx.save();
  ctx.strokeStyle = isHaldiLook ? '#D97706' : template.secondaryColor;
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 34, w - 68, h - 68);
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.restore();
}

export function renderSingleVideoFrame(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  frame: number,
  fps: number,
  project: WeddingProject,
  template: TemplateDefinition,
  scenes: ComputedScene[],
  copy: LocalizedLabels,
  images: LoadedProjectImages
) {
  const activeScene =
    scenes.find(
      (s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames
    ) || scenes[scenes.length - 1];

  const isHaldiLook =
    template.motifStyle === 'marigold' ||
    (activeScene.kind === 'ceremony' && activeScene.ceremony?.type === 'haldi');

  // 1. Background Radial Gradient
  const grad = ctx.createRadialGradient(
    width / 2,
    height * 0.35,
    80,
    width / 2,
    height / 2,
    height * 0.75
  );
  if (isHaldiLook) {
    grad.addColorStop(0, '#FFFDF7');
    grad.addColorStop(1, '#FEF3C7');
  } else {
    grad.addColorStop(0, template.bgColor);
    grad.addColorStop(1, template.bgGradientEnd);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Template Decorations (Mandala, Temple Bells / Pinwheels, Particles, Borders)
  drawTemplateDecorations(ctx, width, height, frame, template, isHaldiLook);

  const sceneFrame = Math.max(0, frame - activeScene.startFrame);
  const sceneDur = activeScene.durationFrames;

  let alpha = 1;
  if (sceneFrame < 12) alpha = sceneFrame / 12;
  else if (sceneFrame > sceneDur - 12) alpha = (sceneDur - sceneFrame) / 12;
  alpha = Math.max(0, Math.min(1, alpha));

  const slideOffset = Math.max(0, 1 - sceneFrame / 18) * 42;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, slideOffset);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontStack = '"Segoe UI", "Nirmala UI", "Georgia", serif';
  const cx = width / 2;
  const primaryAccent = isHaldiLook ? '#B91C1C' : template.secondaryColor;
  const mainText = isHaldiLook ? '#451A03' : template.textColor;
  const subText = isHaldiLook ? '#78350F' : template.mutedTextColor;

  // SCENE 1: GANESH INVOCATION
  if (activeScene.kind === 'ganesh') {
    drawGaneshMotif(ctx, cx, 680, 145, primaryAccent);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 56px ${fontStack}`;
    ctx.fillText(copy.invocation, cx, 940);

    ctx.fillStyle = subText;
    ctx.font = `34px ${fontStack}`;
    const subLines = wrapTextLines(ctx, copy.invocationSub, 820, 3);
    subLines.forEach((line, idx) => {
      ctx.fillText(line, cx, 1040 + idx * 52);
    });

    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 260, 1240, 520, 68);
    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 30px ${fontStack}`;
    ctx.fillText(`${template.nameHindi} • ${template.name}`, cx, 1274);
  }

  // SCENE 2: SHUBH VIVAH / WEDDING INVITATION TITLE (Reference Screenshot 1 Style)
  else if (activeScene.kind === 'title') {
    drawGaneshMotif(ctx, cx, 360, 75, primaryAccent);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 72px ${fontStack}`;
    ctx.fillText('॥ शुभविवाह ॥', cx, 505);

    ctx.fillStyle = mainText;
    ctx.font = `italic bold 34px ${fontStack}`;
    ctx.fillText('Together with their families', cx, 600);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 58px ${fontStack}`;
    const coupleLine = `${project.brideName} & ${project.groomName}`;
    const cLines = wrapTextLines(ctx, coupleLine, 840, 2);
    cLines.forEach((l, i) => ctx.fillText(l, cx, 695 + i * 66));

    ctx.fillStyle = subText;
    ctx.font = `italic 32px ${fontStack}`;
    ctx.fillText(
      'Invite you to celebrate the beginning of their FOREVER',
      cx,
      835
    );

    // Floral Swing Beam & Perched Peacocks + Couple Portrait
    drawPeacockMotif(ctx, cx - 235, 995, false);
    drawPeacockMotif(ctx, cx + 235, 995, true);

    ctx.fillStyle = '#EC4899';
    ctx.fillRect(cx - 230, 1005, 460, 24);

    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      1250,
      380,
      primaryAccent,
      template.accentColor,
      true
    );
  }

  // SCENE 3: BRIDE & GROOM NAMES + PORTRAIT REVEAL
  else if (activeScene.kind === 'couple') {
    drawCroppedPhoto(
      ctx,
      images.bride,
      project.photos.bride,
      cx - 165,
      430,
      250,
      primaryAccent,
      template.accentColor,
      false
    );
    drawCroppedPhoto(
      ctx,
      images.groom,
      project.photos.groom,
      cx + 165,
      430,
      250,
      primaryAccent,
      template.accentColor,
      false
    );

    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      860,
      390,
      primaryAccent,
      template.accentColor,
      true
    );

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 62px ${fontStack}`;
    const bLines = wrapTextLines(ctx, project.brideName, 880, 2);
    bLines.forEach((l, i) => ctx.fillText(l, cx, 1230 + i * 68));

    ctx.fillStyle = subText;
    ctx.font = `bold 34px ${fontStack}`;
    ctx.fillText(`♥  ${copy.wedsLabel}  ♥`, cx, 1365);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 62px ${fontStack}`;
    const gLines = wrapTextLines(ctx, project.groomName, 880, 2);
    gLines.forEach((l, i) => ctx.fillText(l, cx, 1465 + i * 68));

    if (project.hashtag) {
      ctx.fillStyle = primaryAccent;
      ctx.font = `bold 34px ${fontStack}`;
      ctx.fillText(project.hashtag, cx, 1625);
    }
  }

  // SCENE 4: FAMILY INVITATION MESSAGE & PARENTS
  else if (activeScene.kind === 'family') {
    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 52px ${fontStack}`;
    ctx.fillText(copy.familyHeader, cx, 480);

    ctx.fillRect(cx - 160, 545, 320, 3);

    ctx.fillStyle = mainText;
    ctx.font = `38px ${fontStack}`;
    const msg =
      project.familyMessage ||
      'With the divine blessings of Lord Ganesha and our elders, we cordially invite you to celebrate the joyous wedding of our children.';
    const msgLines = wrapTextLines(ctx, `“${msg}”`, 820, 5);
    msgLines.forEach((line, i) => {
      ctx.fillText(line, cx, 660 + i * 58);
    });

    if (project.brideParents) {
      ctx.strokeStyle = primaryAccent;
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 1020, width - 240, 175);

      ctx.fillStyle = subText;
      ctx.font = `28px ${fontStack}`;
      ctx.fillText(`${copy.daughterOf} (${project.brideName})`, cx, 1070);

      ctx.fillStyle = primaryAccent;
      ctx.font = `bold 36px ${fontStack}`;
      const bpLines = wrapTextLines(ctx, project.brideParents, 780, 2);
      bpLines.forEach((l, i) => ctx.fillText(l, cx, 1130 + i * 44));
    }

    if (project.groomParents) {
      ctx.strokeStyle = primaryAccent;
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 1240, width - 240, 175);

      ctx.fillStyle = subText;
      ctx.font = `28px ${fontStack}`;
      ctx.fillText(`${copy.sonOf} (${project.groomName})`, cx, 1290);

      ctx.fillStyle = primaryAccent;
      ctx.font = `bold 36px ${fontStack}`;
      const gpLines = wrapTextLines(ctx, project.groomParents, 780, 2);
      gpLines.forEach((l, i) => ctx.fillText(l, cx, 1350 + i * 44));
    }
  }

  // SCENES 5..N: CEREMONY EVENTS (Reference Screenshot 2 Haldi Split-Date Layout)
  else if (activeScene.kind === 'ceremony' && activeScene.ceremony) {
    const evt = activeScene.ceremony;
    const dParts = parseDateParts(evt.date);
    const isHaldiEvt = evt.type === 'haldi';

    drawGaneshMotif(ctx, cx, 320, 62, isHaldiEvt ? '#DC2626' : primaryAccent);

    ctx.fillStyle = isHaldiEvt ? '#DC2626' : primaryAccent;
    ctx.font = `bold 34px ${fontStack}`;
    ctx.fillText('॥ श्री गणेशाय नमः ॥', cx, 420);

    ctx.fillStyle = mainText;
    ctx.font = `italic bold 34px ${fontStack}`;
    ctx.fillText(
      isHaldiEvt
        ? 'Dulha dulhan ko hai jaldi... Aao lagaye haldi'
        : evt.customMessage || copy.ceremonyHeader,
      cx,
      495
    );

    ctx.fillStyle = isHaldiEvt
      ? '#D97706'
      : evt.type === 'mehndi'
      ? '#059669'
      : primaryAccent;
    ctx.font = `bold 64px ${fontStack}`;
    const nameLines = wrapTextLines(ctx, evt.name, 860, 2);
    nameLines.forEach((l, i) => ctx.fillText(l, cx, 585 + i * 70));

    // Split Date Layout: MONTH / [Weekday] 20 [Time] / YEAR
    ctx.fillStyle = subText;
    ctx.font = `32px ${fontStack}`;
    ctx.fillText(dParts.monthUpper, cx, 700);

    ctx.strokeStyle = subText;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 330, 745);
    ctx.lineTo(cx - 110, 745);
    ctx.moveTo(cx - 330, 815);
    ctx.lineTo(cx - 110, 815);
    ctx.moveTo(cx + 110, 745);
    ctx.lineTo(cx + 330, 745);
    ctx.moveTo(cx + 110, 815);
    ctx.lineTo(cx + 330, 815);
    ctx.stroke();

    ctx.fillStyle = mainText;
    ctx.font = `32px ${fontStack}`;
    ctx.fillText(dParts.weekday, cx - 220, 780);
    ctx.fillText(evt.time.slice(0, 14), cx + 220, 780);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 78px ${fontStack}`;
    ctx.fillText(dParts.day, cx, 782);

    ctx.fillStyle = subText;
    ctx.font = `34px ${fontStack}`;
    ctx.fillText(dParts.year, cx, 865);

    ctx.font = `30px ${fontStack}`;
    ctx.fillText('at', cx, 920);

    ctx.fillStyle = mainText;
    ctx.font = `bold 42px ${fontStack}`;
    const venueLines = wrapTextLines(ctx, evt.venue, 800, 2);
    venueLines.forEach((l, i) => ctx.fillText(l, cx, 980 + i * 50));

    if (evt.address) {
      ctx.fillStyle = subText;
      ctx.font = `28px ${fontStack}`;
      const addrLines = wrapTextLines(ctx, evt.address, 780, 2);
      addrLines.forEach((l, i) => ctx.fillText(l, cx, 1070 + i * 40));
    }

    // Marigold Jhula Arch + Couple Photo at Bottom
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(cx - 210, 1155, 420, 20);
    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      1380,
      330,
      isHaldiEvt ? '#D97706' : primaryAccent,
      '#FDE047',
      true
    );
  }

  // SCENE 8: MAIN WEDDING CEREMONY & PEACOCK MANDAP (Reference Screenshot 3 Style)
  else if (activeScene.kind === 'wedding-main') {
    const wParts = parseDateParts(project.weddingDate);

    ctx.fillStyle = mainText;
    ctx.font = `italic bold 36px ${fontStack}`;
    ctx.fillText('Together with our families', cx, 430);

    ctx.fillStyle = subText;
    ctx.font = `italic 34px ${fontStack}`;
    ctx.fillText('We cordially invite you to join our wedding on', cx, 490);

    // Date Row: NOV ⋮ 21 ⋮ 2026
    ctx.fillStyle = mainText;
    ctx.font = `44px ${fontStack}`;
    ctx.fillText(wParts.monthShort, cx - 190, 600);
    ctx.fillText(wParts.year, cx + 190, 600);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 94px ${fontStack}`;
    ctx.fillText(wParts.day, cx, 600);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 32px ${fontStack}`;
    ctx.fillText(`${project.weddingTime} • At`, cx, 695);

    ctx.fillStyle = mainText;
    ctx.font = `italic bold 42px ${fontStack}`;
    const vLines = wrapTextLines(ctx, project.weddingVenue, 820, 2);
    vLines.forEach((l, i) => ctx.fillText(l, cx, 760 + i * 50));

    ctx.fillStyle = subText;
    ctx.font = `30px ${fontStack}`;
    const aLines = wrapTextLines(ctx, project.weddingAddress, 800, 2);
    aLines.forEach((l, i) => ctx.fillText(l, cx, 855 + i * 42));

    // Golden Domed Wedding Mandap + Two Perched Peacocks + Couple Portrait
    ctx.save();
    ctx.fillStyle = '#FDE047';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 1130, 210, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawPeacockMotif(ctx, cx - 220, 1030, false);
    drawPeacockMotif(ctx, cx + 220, 1030, true);

    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      1330,
      360,
      primaryAccent,
      template.accentColor,
      true
    );

    // Sacred Havan Kund Fire Box at base
    ctx.fillStyle = '#78350F';
    ctx.fillRect(cx - 140, 1545, 280, 48);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 140, 1545, 280, 48);
    ctx.fillStyle = '#FEF08A';
    ctx.font = `bold 24px ${fontStack}`;
    ctx.fillText('शुभ लग्न मंडप • Sacred Mandap', cx, 1569);
  }

  // SCENE 9: CLOSING INVITATION & RSVP
  else if (activeScene.kind === 'closing') {
    drawCroppedPhoto(
      ctx,
      images.gallery || images.couple,
      project.photos.gallery || project.photos.couple,
      cx,
      540,
      290,
      primaryAccent,
      template.accentColor,
      false
    );

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 54px ${fontStack}`;
    const chLines = wrapTextLines(ctx, copy.closingHeader, 840, 2);
    chLines.forEach((l, i) => ctx.fillText(l, cx, 810 + i * 64));

    ctx.fillStyle = mainText;
    ctx.font = `36px ${fontStack}`;
    const cmLines = wrapTextLines(ctx, copy.closingMessage, 820, 3);
    cmLines.forEach((l, i) => ctx.fillText(l, cx, 955 + i * 50));

    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(110, 1140, width - 220, 260);

    ctx.fillStyle = subText;
    ctx.font = `30px ${fontStack}`;
    ctx.fillText(copy.rsvpHeader, cx, 1200);

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 36px ${fontStack}`;
    const rsvpText =
      project.rsvpDetails ||
      `${project.brideName} & ${project.groomName} Families`;
    const rLines = wrapTextLines(ctx, rsvpText, 780, 2);
    rLines.forEach((l, i) => ctx.fillText(l, cx, 1265 + i * 46));

    if (project.contactPhone) {
      ctx.fillStyle = mainText;
      ctx.font = `32px ${fontStack}`;
      ctx.fillText(`Tel: ${project.contactPhone}`, cx, 1355);
    }

    ctx.fillStyle = primaryAccent;
    ctx.font = `bold 46px ${fontStack}`;
    ctx.fillText(`${project.brideName}  ♥  ${project.groomName}`, cx, 1525);
  }

  ctx.restore();
}

export function createRenderCanvas(width: number, height: number) {
  return createCanvas(width, height);
}

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
  getLocalizedCopy,
  LocalizedLabels,
} from '@/lib/video/sceneCalculator';
import { objectStorage } from '@/lib/storage/objectStorage';

export interface LoadedProjectImages {
  bride?: Image;
  groom?: Image;
  couple?: Image;
  gallery?: Image;
}

async function resolveAndLoadImage(url?: string): Promise<Image | undefined> {
  if (!url) return undefined;
  try {
    // 1. Private uploaded photo stored via objectStorage (Supabase Storage / persistent store)
    if (url.startsWith('/api/media/photo/')) {
      const fileName = path.basename(
        decodeURIComponent(url.replace('/api/media/photo/', '').split('?')[0])
      );
      const buf = await objectStorage.downloadObject('photos', fileName);
      if (buf && buf.length > 0) {
        return await loadImage(buf);
      }
    }

    // 2. Remote HTTP/HTTPS URL (e.g. direct Supabase signed URL)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const res = await fetch(url);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return await loadImage(Buffer.from(arr));
      }
    }

    // 3. Read-only static public asset (/samples/...)
    if (url.startsWith('/')) {
      const publicPath = path.join(process.cwd(), 'public', url.split('?')[0]);
      if (fs.existsSync(publicPath)) {
        const buf = fs.readFileSync(publicPath);
        return await loadImage(buf);
      }
    }

    // 4. Data URL
    if (url.startsWith('data:image/')) {
      return await loadImage(url);
    }

    // Fallback to couple sample portrait
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
  const h = arch ? Math.round(size * 1.18) : size;
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

  // Fill background
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
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Outer sacred circles
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.84, 0, Math.PI * 2);
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

function drawTemplateDecorations(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  frame: number,
  template: TemplateDefinition
) {
  // 1. Rotating Center Mandala
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((frame * 0.0045) % (Math.PI * 2));
  ctx.strokeStyle = template.secondaryColor;
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

  // 2. Top Hanging Garlands / Lanterns / Temple Bells
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x = 110 + i * 143;
    const len = 75 + (i % 2) * 38;
    const swing = Math.sin(frame * 0.08 + i) * 8;
    ctx.save();
    ctx.translate(x, 38);
    ctx.rotate((swing * Math.PI) / 180);
    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len);
    ctx.stroke();

    ctx.fillStyle =
      template.motifStyle === 'marigold'
        ? i % 2 === 0
          ? '#F59E0B'
          : '#EA580C'
        : template.secondaryColor;
    ctx.beginPath();
    ctx.arc(0, len + 14, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 3. Falling Petals / Golden Particles
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const seed = (i + 1) * 53;
    const baseX = ((seed * 41) % (w - 140)) + 70;
    const speed = 3.6 + (i % 4) * 1.3;
    const y = ((frame * speed + seed * 23) % (h + 60)) - 30;
    const drift = Math.sin(frame * 0.05 + i) * 24;

    ctx.fillStyle =
      template.motifStyle === 'marigold'
        ? i % 2 === 0
          ? '#F59E0B'
          : '#FACC15'
        : template.motifStyle === 'floral-arch'
        ? '#F472B6'
        : template.secondaryColor;
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    ctx.ellipse(baseX + drift, y, 7, 11, frame * 0.03 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Double Royal Border
  ctx.save();
  ctx.strokeStyle = template.secondaryColor;
  ctx.lineWidth = 5;
  ctx.strokeRect(38, 38, w - 76, h - 76);
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 52, w - 104, h - 104);
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
  // 1. Background Radial Gradient
  const grad = ctx.createRadialGradient(
    width / 2,
    height * 0.35,
    80,
    width / 2,
    height / 2,
    height * 0.75
  );
  grad.addColorStop(0, template.bgColor);
  grad.addColorStop(1, template.bgGradientEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Template Decorations (Mandala, Garlands, Particles, Borders)
  drawTemplateDecorations(ctx, width, height, frame, template);

  // 3. Determine Active Scene
  const activeScene =
    scenes.find(
      (s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames
    ) || scenes[scenes.length - 1];

  const sceneFrame = Math.max(0, frame - activeScene.startFrame);
  const sceneDur = activeScene.durationFrames;

  // Smooth fade-in (first 12 frames) & fade-out (last 12 frames)
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

  // SCENE 1: GANESH INVOCATION
  if (activeScene.kind === 'ganesh') {
    drawGaneshMotif(ctx, cx, 680, 145, template.secondaryColor);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 56px ${fontStack}`;
    ctx.fillText(copy.invocation, cx, 940);

    ctx.fillStyle = template.mutedTextColor;
    ctx.font = `34px ${fontStack}`;
    const subLines = wrapTextLines(ctx, copy.invocationSub, 820, 3);
    subLines.forEach((line, idx) => {
      ctx.fillText(line, cx, 1040 + idx * 52);
    });

    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 260, 1240, 520, 68);
    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 30px ${fontStack}`;
    ctx.fillText(`${template.nameHindi} • ${template.name}`, cx, 1274);
  }

  // SCENE 2: SHUBH VIVAH / WEDDING INVITATION TITLE
  else if (activeScene.kind === 'title') {
    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 34px ${fontStack}`;
    ctx.fillText(copy.invocation, cx, 520);

    ctx.font = `bold 78px ${fontStack}`;
    const titleLines = wrapTextLines(ctx, copy.titleMain, 880, 2);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, cx, 670 + i * 92);
    });

    // Divider line
    ctx.fillStyle = template.secondaryColor;
    ctx.fillRect(cx - 180, 840, 360, 4);

    ctx.fillStyle = template.textColor;
    ctx.font = `38px ${fontStack}`;
    const subLines = wrapTextLines(ctx, copy.titleSub, 820, 2);
    subLines.forEach((line, i) => {
      ctx.fillText(line, cx, 920 + i * 54);
    });

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 60px ${fontStack}`;
    const brideLines = wrapTextLines(ctx, project.brideName, 880, 2);
    brideLines.forEach((l, i) => ctx.fillText(l, cx, 1120 + i * 68));

    ctx.fillStyle = template.mutedTextColor;
    ctx.font = `italic 36px ${fontStack}`;
    ctx.fillText(`— ${copy.wedsLabel} —`, cx, 1255);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 60px ${fontStack}`;
    const groomLines = wrapTextLines(ctx, project.groomName, 880, 2);
    groomLines.forEach((l, i) => ctx.fillText(l, cx, 1360 + i * 68));
  }

  // SCENE 3: BRIDE & GROOM NAMES + PORTRAIT REVEAL
  else if (activeScene.kind === 'couple') {
    // Bride & Groom circular portraits at top
    drawCroppedPhoto(
      ctx,
      images.bride,
      project.photos.bride,
      cx - 165,
      430,
      250,
      template.secondaryColor,
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
      template.secondaryColor,
      template.accentColor,
      false
    );

    // Couple main arch photo
    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      860,
      390,
      template.secondaryColor,
      template.accentColor,
      true
    );

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 62px ${fontStack}`;
    const bLines = wrapTextLines(ctx, project.brideName, 880, 2);
    bLines.forEach((l, i) => ctx.fillText(l, cx, 1230 + i * 68));

    ctx.fillStyle = template.mutedTextColor;
    ctx.font = `bold 34px ${fontStack}`;
    ctx.fillText(`♥  ${copy.wedsLabel}  ♥`, cx, 1365);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 62px ${fontStack}`;
    const gLines = wrapTextLines(ctx, project.groomName, 880, 2);
    gLines.forEach((l, i) => ctx.fillText(l, cx, 1465 + i * 68));

    if (project.hashtag) {
      ctx.fillStyle = template.secondaryColor;
      ctx.font = `bold 34px ${fontStack}`;
      ctx.fillText(project.hashtag, cx, 1625);
    }
  }

  // SCENE 4: FAMILY INVITATION MESSAGE & PARENTS
  else if (activeScene.kind === 'family') {
    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 52px ${fontStack}`;
    ctx.fillText(copy.familyHeader, cx, 480);

    ctx.fillRect(cx - 160, 545, 320, 3);

    ctx.fillStyle = template.textColor;
    ctx.font = `38px ${fontStack}`;
    const msg =
      project.familyMessage ||
      'With the divine blessings of Lord Ganesha and our elders, we cordially invite you to celebrate the joyous wedding of our children.';
    const msgLines = wrapTextLines(ctx, `“${msg}”`, 820, 5);
    msgLines.forEach((line, i) => {
      ctx.fillText(line, cx, 660 + i * 58);
    });

    if (project.brideParents) {
      ctx.strokeStyle = template.secondaryColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 1020, width - 240, 175);

      ctx.fillStyle = template.mutedTextColor;
      ctx.font = `28px ${fontStack}`;
      ctx.fillText(`${copy.daughterOf} (${project.brideName})`, cx, 1070);

      ctx.fillStyle = template.secondaryColor;
      ctx.font = `bold 36px ${fontStack}`;
      const bpLines = wrapTextLines(ctx, project.brideParents, 780, 2);
      bpLines.forEach((l, i) => ctx.fillText(l, cx, 1130 + i * 44));
    }

    if (project.groomParents) {
      ctx.strokeStyle = template.secondaryColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 1240, width - 240, 175);

      ctx.fillStyle = template.mutedTextColor;
      ctx.font = `28px ${fontStack}`;
      ctx.fillText(`${copy.sonOf} (${project.groomName})`, cx, 1290);

      ctx.fillStyle = template.secondaryColor;
      ctx.font = `bold 36px ${fontStack}`;
      const gpLines = wrapTextLines(ctx, project.groomParents, 780, 2);
      gpLines.forEach((l, i) => ctx.fillText(l, cx, 1350 + i * 44));
    }
  }

  // SCENES 5..N: CEREMONY EVENTS (Haldi, Mehndi, Sangeet, etc.)
  else if (activeScene.kind === 'ceremony' && activeScene.ceremony) {
    const evt = activeScene.ceremony;
    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 32px ${fontStack}`;
    ctx.fillText(copy.ceremonyHeader.toUpperCase(), cx, 500);

    ctx.fillStyle =
      evt.type === 'haldi'
        ? '#F59E0B'
        : evt.type === 'mehndi'
        ? '#10B981'
        : template.secondaryColor;
    ctx.font = `bold 74px ${fontStack}`;
    const nameLines = wrapTextLines(ctx, evt.name, 860, 2);
    nameLines.forEach((l, i) => ctx.fillText(l, cx, 640 + i * 82));

    // Card Box
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(100, 790, width - 200, 620);
    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 790, width - 200, 620);

    ctx.fillStyle = template.textColor;
    ctx.font = `bold 44px ${fontStack}`;
    ctx.fillText(formatReadableDate(evt.date), cx, 895);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 38px ${fontStack}`;
    ctx.fillText(evt.time, cx, 975);

    ctx.fillRect(cx - 120, 1030, 240, 2);

    ctx.fillStyle = template.textColor;
    ctx.font = `bold 42px ${fontStack}`;
    const venueLines = wrapTextLines(ctx, evt.venue, 780, 2);
    venueLines.forEach((l, i) => ctx.fillText(l, cx, 1105 + i * 52));

    if (evt.address) {
      ctx.fillStyle = template.mutedTextColor;
      ctx.font = `32px ${fontStack}`;
      const addrLines = wrapTextLines(ctx, evt.address, 780, 2);
      addrLines.forEach((l, i) => ctx.fillText(l, cx, 1215 + i * 44));
    }

    if (evt.customMessage) {
      ctx.fillStyle = template.secondaryColor;
      ctx.font = `italic 32px ${fontStack}`;
      const msgLines = wrapTextLines(ctx, `✦ ${evt.customMessage} ✦`, 780, 2);
      msgLines.forEach((l, i) => ctx.fillText(l, cx, 1335 + i * 42));
    }
  }

  // SCENE 8: MAIN WEDDING CEREMONY & MANDAP
  else if (activeScene.kind === 'wedding-main') {
    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 30px ${fontStack}`;
    ctx.fillText(copy.weddingSub.toUpperCase(), cx, 360);

    ctx.font = `bold 62px ${fontStack}`;
    ctx.fillText(copy.weddingHeader, cx, 445);

    drawCroppedPhoto(
      ctx,
      images.couple,
      project.photos.couple,
      cx,
      780,
      360,
      template.secondaryColor,
      template.accentColor,
      true
    );

    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(95, 1060, width - 190, 560);
    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(95, 1060, width - 190, 560);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 46px ${fontStack}`;
    ctx.fillText(formatReadableDate(project.weddingDate), cx, 1155);

    ctx.fillStyle = template.textColor;
    ctx.font = `bold 36px ${fontStack}`;
    ctx.fillText(project.weddingTime, cx, 1230);

    ctx.fillStyle = template.secondaryColor;
    ctx.fillRect(cx - 140, 1280, 280, 2);

    ctx.fillStyle = template.textColor;
    ctx.font = `bold 42px ${fontStack}`;
    const vLines = wrapTextLines(ctx, project.weddingVenue, 800, 2);
    vLines.forEach((l, i) => ctx.fillText(l, cx, 1350 + i * 50));

    ctx.fillStyle = template.mutedTextColor;
    ctx.font = `30px ${fontStack}`;
    const aLines = wrapTextLines(ctx, project.weddingAddress, 800, 3);
    aLines.forEach((l, i) => ctx.fillText(l, cx, 1465 + i * 42));
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
      template.secondaryColor,
      template.accentColor,
      false
    );

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 54px ${fontStack}`;
    const chLines = wrapTextLines(ctx, copy.closingHeader, 840, 2);
    chLines.forEach((l, i) => ctx.fillText(l, cx, 810 + i * 64));

    ctx.fillStyle = template.textColor;
    ctx.font = `36px ${fontStack}`;
    const cmLines = wrapTextLines(ctx, copy.closingMessage, 820, 3);
    cmLines.forEach((l, i) => ctx.fillText(l, cx, 955 + i * 50));

    ctx.strokeStyle = template.secondaryColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(110, 1140, width - 220, 260);

    ctx.fillStyle = template.mutedTextColor;
    ctx.font = `30px ${fontStack}`;
    ctx.fillText(copy.rsvpHeader, cx, 1200);

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 36px ${fontStack}`;
    const rsvpText =
      project.rsvpDetails || `${project.brideName} & ${project.groomName} Families`;
    const rLines = wrapTextLines(ctx, rsvpText, 780, 2);
    rLines.forEach((l, i) => ctx.fillText(l, cx, 1265 + i * 46));

    if (project.contactPhone) {
      ctx.fillStyle = template.textColor;
      ctx.font = `32px ${fontStack}`;
      ctx.fillText(`Tel: ${project.contactPhone}`, cx, 1355);
    }

    ctx.fillStyle = template.secondaryColor;
    ctx.font = `bold 46px ${fontStack}`;
    ctx.fillText(`${project.brideName}  ♥  ${project.groomName}`, cx, 1525);
  }

  ctx.restore();
}

export function createRenderCanvas(width: number, height: number) {
  return createCanvas(width, height);
}

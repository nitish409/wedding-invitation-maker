'use client';

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  PhotoSlotConfig,
  TemplateDefinition,
  WeddingProjectInput,
} from '@/types/wedding';
import {
  calculateWeddingScenes,
  formatReadableDate,
  getLocalizedCopy,
  getTemplateById,
} from '@/lib/video/sceneCalculator';

export interface WeddingVideoProps {
  project: WeddingProjectInput;
  customTemplates?: TemplateDefinition[];
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

function FramedPhoto({
  slot,
  size = 400,
  borderColor = '#D4AF37',
  accentColor = '#F3E5AB',
  arch = false,
}: {
  slot: PhotoSlotConfig;
  size?: number;
  borderColor?: string;
  accentColor?: string;
  arch?: boolean;
}) {
  const zoom = Math.max(0.8, Math.min(3, slot?.zoom || 1));
  const offsetX = slot?.offsetX || 0;
  const offsetY = slot?.offsetY || 0;
  const removeBg = slot?.removeBg || false;

  return (
    <div
      style={{
        width: size,
        height: arch ? size * 1.15 : size,
        borderRadius: arch ? `${size / 2}px ${size / 2}px 28px 28px` : '50%',
        border: `8px solid ${borderColor}`,
        boxShadow: `0 0 0 6px rgba(212,175,55,0.28), 0 20px 45px rgba(0,0,0,0.45)`,
        overflow: 'hidden',
        position: 'relative',
        background: removeBg
          ? `radial-gradient(circle, ${accentColor} 0%, ${borderColor} 100%)`
          : '#2A0810',
        margin: '0 auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slot?.url || '/samples/couple-sample.png'}
        alt={slot?.caption || 'Wedding Portrait'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${zoom}) translate(${offsetX * 0.5}%, ${offsetY * 0.5}%)`,
          transformOrigin: 'center center',
          filter: removeBg
            ? 'contrast(1.08) saturate(1.1) drop-shadow(0 8px 20px rgba(0,0,0,0.4))'
            : 'none',
          maskImage: removeBg
            ? 'radial-gradient(circle at center, black 58%, transparent 92%)'
            : undefined,
          WebkitMaskImage: removeBg
            ? 'radial-gradient(circle at center, black 58%, transparent 92%)'
            : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 8,
          borderRadius: arch ? `${size / 2}px ${size / 2}px 20px 20px` : '50%',
          border: `2px dashed ${accentColor}`,
          pointerEvents: 'none',
          opacity: 0.75,
        }}
      />
    </div>
  );
}

function GaneshMotifSVG({ color, size = 210 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle
        cx="100"
        cy="100"
        r="90"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray="6 6"
        opacity="0.7"
      />
      <circle cx="100" cy="100" r="76" stroke={color} strokeWidth="2" opacity="0.5" />
      <path
        d="M70 68 L100 24 L130 68 Z"
        stroke={color}
        strokeWidth="4"
        fill={color}
        fillOpacity="0.2"
      />
      <circle cx="100" cy="20" r="6" fill={color} />
      <path
        d="M68 78 C36 70, 34 118, 68 114"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M132 78 C164 70, 166 118, 132 114"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M74 72 C74 55, 126 55, 126 72 C126 95, 112 108, 104 126 C98 140, 115 152, 124 140"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <line x1="88" y1="76" x2="112" y2="76" stroke={color} strokeWidth="3" />
      <line x1="92" y1="83" x2="108" y2="83" stroke={color} strokeWidth="3" />
      <circle cx="100" cy="91" r="4" fill={color} />
    </svg>
  );
}

/**
 * Peacock SVG Motif (Perched left or right)
 */
function PeacockMotif({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="150"
      height="190"
      viewBox="0 0 150 190"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      {/* Tail feathers */}
      <path
        d="M65 85 C30 105, 12 145, 8 182 C38 175, 68 142, 78 95 Z"
        fill="#047857"
      />
      <circle cx="28" cy="155" r="8" fill="#D4AF37" />
      <circle cx="28" cy="155" r="4" fill="#1D4ED8" />
      <circle cx="45" cy="135" r="7" fill="#D4AF37" />
      <circle cx="45" cy="135" r="3.5" fill="#1D4ED8" />
      <circle cx="38" cy="166" r="6" fill="#D4AF37" />
      <circle cx="38" cy="166" r="3" fill="#1D4ED8" />
      {/* Body & Neck */}
      <ellipse cx="82" cy="78" rx="22" ry="28" fill="#1E40AF" />
      <path
        d="M84 55 C82 32, 96 20, 104 28 C108 33, 98 48, 95 66"
        fill="#1D4ED8"
      />
      {/* Beak & Crest */}
      <polygon points="104,26 116,30 104,34" fill="#F59E0B" />
      <line x1="96" y1="22" x2="92" y2="12" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="92" cy="11" r="3" fill="#D4AF37" />
      <line x1="100" y1="22" x2="100" y2="11" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="100" cy="10" r="3" fill="#D4AF37" />
    </svg>
  );
}

/**
 * Swinging Brass Temple Bell (Ghanti) on Marigold Garland
 */
function TempleBell({
  height = 140,
  swingDeg = 0,
}: {
  height?: number;
  swingDeg?: number;
}) {
  const pompoms = Math.max(2, Math.floor((height - 55) / 28));
  return (
    <div
      style={{
        transform: `rotate(${swingDeg}deg)`,
        transformOrigin: 'top center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: pompoms }).map((_, idx) => (
        <div
          key={idx}
          style={{
            width: 24,
            height: 22,
            borderRadius: '50%',
            background: idx % 2 === 0 ? '#FACC15' : '#F59E0B',
            boxShadow: 'inset 0 -3px 6px rgba(180,83,9,0.45)',
            marginBottom: 3,
          }}
        />
      ))}
      <svg width="56" height="54" viewBox="0 0 56 54">
        <rect x="24" y="0" width="8" height="10" rx="3" fill="#B45309" />
        <path
          d="M14 16 C14 8, 42 8, 42 16 L49 42 C50 45, 6 45, 7 42 Z"
          fill="url(#bellGold)"
          stroke="#92400E"
          strokeWidth="2"
        />
        <circle cx="28" cy="46" r="5" fill="#B45309" />
        <defs>
          <linearGradient id="bellGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B45309" />
            <stop offset="50%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/**
 * Yellow Folded Paper Fan Wheel (Haldi Pinwheel Decoration)
 */
function HaldiPaperWheel({
  size = 180,
  rotation = 0,
}: {
  size?: number;
  rotation?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <circle cx="100" cy="100" r="95" fill="#FDE047" stroke="#F59E0B" strokeWidth="3" />
      {Array.from({ length: 24 }).map((_, i) => {
        const ang = (i * 360) / 24;
        return (
          <g key={i} transform={`rotate(${ang} 100 100)`}>
            <polygon
              points="100,100 92,6 108,6"
              fill={i % 2 === 0 ? '#F59E0B' : '#FEF08A'}
            />
          </g>
        );
      })}
      <circle cx="100" cy="100" r="18" fill="#D97706" />
      <circle cx="100" cy="100" r="8" fill="#FEF9C3" />
    </svg>
  );
}

export const WeddingInvitationVideo: React.FC<WeddingVideoProps> = ({
  project,
  customTemplates,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const template = useMemo(
    () => getTemplateById(project.templateId, customTemplates),
    [project.templateId, customTemplates]
  );

  const { scenes, totalFrames } = useMemo(
    () => calculateWeddingScenes(project, fps),
    [project, fps]
  );

  const copy = useMemo(() => getLocalizedCopy(project.language), [project.language]);

  const activeScene =
    scenes.find(
      (s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames
    ) || scenes[scenes.length - 1];

  const sceneFrame = Math.max(0, frame - activeScene.startFrame);
  const sceneDuration = activeScene.durationFrames;

  const sceneOpacity = interpolate(
    sceneFrame,
    [0, 14, sceneDuration - 14, sceneDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const entranceSpring = spring({
    frame: sceneFrame,
    fps,
    config: { damping: 16, stiffness: 90, mass: 0.9 },
  });

  const translateY = interpolate(entranceSpring, [0, 1], [44, 0]);
  const scaleIn = interpolate(entranceSpring, [0, 1], [0.93, 1]);

  const baseVolume = project.music?.volume ?? 0.85;
  const audioEnvelope = interpolate(
    frame,
    [0, fps * 2, Math.max(fps * 2 + 1, totalFrames - fps * 2.5), totalFrames],
    [0, baseVolume, baseVolume, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const startFromFrames = Math.round((project.music?.startOffsetSec || 0) * fps);

  const isHaldiLook =
    template.motifStyle === 'marigold' ||
    (activeScene.kind === 'ceremony' && activeScene.ceremony?.type === 'haldi');

  const isFloralSwingLook = template.motifStyle === 'floral-arch';

  return (
    <AbsoluteFill
      style={{
        background: isHaldiLook
          ? 'radial-gradient(circle at 50% 30%, #FFFDF7 0%, #FEF3C7 100%)'
          : `radial-gradient(circle at 50% 32%, ${template.bgColor} 0%, ${template.bgGradientEnd} 100%)`,
        color: isHaldiLook ? '#5C1916' : template.textColor,
        fontFamily: '"Cormorant Garamond", "Noto Serif Devanagari", serif',
        overflow: 'hidden',
      }}
    >
      {/* Audio Track */}
      {project.music?.url && (
        <Audio
          src={project.music.url}
          startFrom={startFromFrames}
          volume={audioEnvelope}
          loop
        />
      )}

      {/* Rotating Sacred Background Mandala / Halo */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '50%',
          width: 960,
          height: 960,
          marginLeft: -480,
          marginTop: -480,
          transform: `rotate(${frame * 0.25}deg)`,
          opacity: isHaldiLook ? 0.12 : 0.15,
          pointerEvents: 'none',
        }}
      >
        <svg viewBox="0 0 400 400" width="100%" height="100%">
          <circle
            cx="200"
            cy="200"
            r="190"
            stroke={isHaldiLook ? '#D97706' : template.secondaryColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 8"
          />
          <circle
            cx="200"
            cy="200"
            r="150"
            stroke={isHaldiLook ? '#D97706' : template.secondaryColor}
            strokeWidth="1.5"
            fill="none"
          />
          {Array.from({ length: 16 }).map((_, idx) => {
            const angle = (idx * 360) / 16;
            return (
              <g key={idx} transform={`rotate(${angle} 200 200)`}>
                <ellipse
                  cx="200"
                  cy="65"
                  rx="18"
                  ry="48"
                  stroke={isHaldiLook ? '#D97706' : template.secondaryColor}
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* TOP DECORATIONS INSPIRED BY REFERENCE VIDEO */}
      {isHaldiLook ? (
        /* Haldi Pinwheels & Marigold Garlands (Inspired by Reference Screenshot 2) */
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'absolute', top: -70, left: -50 }}>
            <HaldiPaperWheel size={220} rotation={frame * 0.4} />
          </div>
          <div style={{ position: 'absolute', top: -95, left: 210 }}>
            <HaldiPaperWheel size={320} rotation={-frame * 0.3} />
          </div>
          <div style={{ position: 'absolute', top: -60, right: -50 }}>
            <HaldiPaperWheel size={210} rotation={frame * 0.35} />
          </div>
          <div style={{ position: 'absolute', top: 560, right: -85 }}>
            <HaldiPaperWheel size={230} rotation={-frame * 0.4} />
          </div>

          {/* Hanging Marigold Strings */}
          {[95, 165, 760, 845, 935].map((xPos, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: 10,
                left: xPos,
                transform: `rotate(${Math.sin(frame * 0.07 + idx) * 4}deg)`,
                transformOrigin: 'top center',
              }}
            >
              {Array.from({ length: 4 + (idx % 3) }).map((__, pIdx) => (
                <div
                  key={pIdx}
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: '50%',
                    background: pIdx % 2 === 0 ? '#FACC15' : '#F59E0B',
                    marginBottom: 6,
                    boxShadow: '0 4px 10px rgba(217,119,6,0.25)',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* Ornate Palace Arch + Hanging Brass Temple Bells (Inspired by Reference Screenshot 3) */
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 360,
            pointerEvents: 'none',
          }}
        >
          <svg width="1080" height="320" viewBox="0 0 1080 320" fill="none">
            <path
              d="M0 0 L1080 0 L1080 280 C980 220, 920 120, 800 95 C670 68, 600 32, 540 16 C480 32, 410 68, 280 95 C160 120, 100 220, 0 280 Z"
              fill={template.secondaryColor}
              fillOpacity="0.18"
            />
            <path
              d="M24 270 C120 200, 180 110, 300 88 C420 64, 485 34, 540 18 C595 34, 660 64, 780 88 C900 110, 960 200, 1056 270"
              stroke={template.secondaryColor}
              strokeWidth="6"
              fill="none"
            />
          </svg>
          {/* Three Center Swinging Brass Temple Bells + Two Side Bells */}
          <div style={{ position: 'absolute', top: 38, left: 400 }}>
            <TempleBell height={155} swingDeg={Math.sin(frame * 0.08) * 6} />
          </div>
          <div style={{ position: 'absolute', top: 24, left: 512 }}>
            <TempleBell height={190} swingDeg={Math.sin(frame * 0.08 + 1.2) * 7} />
          </div>
          <div style={{ position: 'absolute', top: 38, left: 624 }}>
            <TempleBell height={155} swingDeg={Math.sin(frame * 0.08 + 2.4) * 6} />
          </div>
          <div style={{ position: 'absolute', top: 165, left: 56 }}>
            <TempleBell height={210} swingDeg={Math.sin(frame * 0.07 + 0.5) * 5} />
          </div>
          <div style={{ position: 'absolute', top: 165, right: 56 }}>
            <TempleBell height={210} swingDeg={Math.sin(frame * 0.07 + 1.8) * 5} />
          </div>
        </div>
      )}

      {/* VINTAGE HERITAGE STREET LAMPS (Inspired by Reference Screenshot 1) */}
      {isFloralSwingLook && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* Left Street Lamp */}
          <svg
            width="160"
            height="1350"
            viewBox="0 0 160 1350"
            style={{ position: 'absolute', left: 18, bottom: 180 }}
          >
            <polygon
              points="30,190 130,190 148,105 12,105"
              fill="#FFFBEB"
              stroke="#3E2723"
              strokeWidth="7"
            />
            <polygon points="8,105 152,105 80,45" fill="#3E2723" />
            <rect x="66" y="190" width="28" height="980" fill="#3E2723" />
            <rect x="44" y="1140" width="72" height="190" rx="8" fill="#2D1B17" />
          </svg>
          {/* Right Street Lamp */}
          <svg
            width="160"
            height="1350"
            viewBox="0 0 160 1350"
            style={{ position: 'absolute', right: 18, bottom: 180 }}
          >
            <polygon
              points="30,190 130,190 148,105 12,105"
              fill="#FFFBEB"
              stroke="#3E2723"
              strokeWidth="7"
            />
            <polygon points="8,105 152,105 80,45" fill="#3E2723" />
            <rect x="66" y="190" width="28" height="980" fill="#3E2723" />
            <rect x="44" y="1140" width="72" height="190" rx="8" fill="#2D1B17" />
          </svg>
        </div>
      )}

      {/* Falling Petals / Golden Dust Particles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const seed = (i + 1) * 47;
          const x = ((seed * 43) % 960) + 60;
          const speed = 2.4 + (i % 4) * 0.9;
          const y = ((frame * speed + seed * 19) % 1980) - 40;
          const drift = Math.sin(frame * 0.04 + i) * 24;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x + drift,
                top: y,
                width: isHaldiLook || isFloralSwingLook ? 16 : 10,
                height: isHaldiLook || isFloralSwingLook ? 22 : 10,
                borderRadius:
                  isHaldiLook || isFloralSwingLook ? '60% 40% 60% 40%' : '50%',
                background: isHaldiLook
                  ? i % 2 === 0
                    ? '#F59E0B'
                    : '#FACC15'
                  : isFloralSwingLook
                  ? '#F472B6'
                  : template.secondaryColor,
                opacity: 0.58,
                transform: `rotate(${frame * 2 + i * 30}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* Ornate Double Royal Frame Border */}
      <div
        style={{
          position: 'absolute',
          inset: 30,
          border: `4px solid ${isHaldiLook ? '#D97706' : template.secondaryColor}`,
          borderRadius: 28,
          boxShadow: `inset 0 0 0 10px transparent, inset 0 0 0 12px ${
            isHaldiLook ? '#D9770666' : `${template.secondaryColor}66`
          }`,
          pointerEvents: 'none',
        }}
      />

      {/* Scene Content Container */}
      <AbsoluteFill
        style={{
          padding: '150px 84px 110px 84px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          opacity: sceneOpacity,
          transform: `translateY(${translateY}px) scale(${scaleIn})`,
        }}
      >
        {/* SCENE 1: GANESH JI INVOCATION */}
        {activeScene.kind === 'ganesh' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 32,
            }}
          >
            <GaneshMotifSVG
              color={isHaldiLook ? '#B91C1C' : template.secondaryColor}
              size={260}
            />
            <div
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: isHaldiLook ? '#B91C1C' : template.secondaryColor,
                letterSpacing: '0.04em',
              }}
            >
              {copy.invocation}
            </div>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.5,
                color: isHaldiLook ? '#7C2D12' : template.mutedTextColor,
                maxWidth: 780,
              }}
            >
              {copy.invocationSub}
            </div>
            <div
              style={{
                marginTop: 20,
                padding: '12px 36px',
                borderRadius: 999,
                border: `2px solid ${
                  isHaldiLook ? '#D97706' : template.secondaryColor
                }`,
                fontSize: 28,
                color: isHaldiLook ? '#B45309' : template.secondaryColor,
              }}
            >
              {template.nameHindi} • {template.name}
            </div>
          </div>
        )}

        {/* SCENE 2: SHUBH VIVAH / WEDDING INVITATION TITLE (Reference Screenshot 1 Style) */}
        {activeScene.kind === 'title' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              width: '100%',
            }}
          >
            <GaneshMotifSVG
              color={isHaldiLook ? '#991B1B' : template.secondaryColor}
              size={140}
            />
            <div
              style={{
                fontSize: 74,
                fontWeight: 700,
                lineHeight: 1.15,
                color: isHaldiLook ? '#7F1D1D' : template.secondaryColor,
                textShadow: '0 4px 18px rgba(0,0,0,0.18)',
              }}
            >
              ॥ शुभविवाह ॥
            </div>
            <div
              style={{
                fontSize: 34,
                fontStyle: 'italic',
                fontWeight: 600,
                color: template.textColor,
              }}
            >
              Together with their families
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: isHaldiLook ? '#7F1D1D' : template.secondaryColor,
                margin: '6px 0',
                lineHeight: 1.15,
              }}
            >
              {project.brideName} &amp; {project.groomName}
            </div>
            <div
              style={{
                fontSize: 32,
                fontStyle: 'italic',
                color: template.mutedTextColor,
                maxWidth: 740,
              }}
            >
              Invite you to celebrate the beginning of their FOREVER
            </div>

            {/* Floral Swing / Jhula with Peacocks & Couple Portrait */}
            <div
              style={{
                position: 'relative',
                marginTop: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -25,
                  left: -135,
                  zIndex: 2,
                }}
              >
                <PeacockMotif />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: -25,
                  right: -135,
                  zIndex: 2,
                }}
              >
                <PeacockMotif flip />
              </div>
              {/* Top Floral Garland Bar of Jhula */}
              <div
                style={{
                  width: 470,
                  height: 36,
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, #EC4899, #A855F7, #FACC15, #10B981, #EC4899)',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                  marginBottom: -14,
                  zIndex: 3,
                }}
              />
              <FramedPhoto
                slot={project.photos.couple}
                size={360}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
                arch
              />
            </div>
          </div>
        )}

        {/* SCENE 3: BRIDE & GROOM NAMES + PORTRAIT REVEAL */}
        {activeScene.kind === 'couple' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 36,
              }}
            >
              <FramedPhoto
                slot={project.photos.bride}
                size={240}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
              <FramedPhoto
                slot={project.photos.groom}
                size={240}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
            </div>

            <FramedPhoto
              slot={project.photos.couple}
              size={370}
              borderColor={template.secondaryColor}
              accentColor={template.accentColor}
              arch
            />

            <div
              style={{
                fontSize: 60,
                fontWeight: 700,
                lineHeight: 1.15,
                color: template.secondaryColor,
                marginTop: 8,
                maxWidth: 860,
                wordBreak: 'break-word',
              }}
            >
              {project.brideName}
            </div>
            <div
              style={{
                fontSize: 32,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: template.mutedTextColor,
              }}
            >
              — {copy.wedsLabel} —
            </div>
            <div
              style={{
                fontSize: 60,
                fontWeight: 700,
                lineHeight: 1.15,
                color: template.secondaryColor,
                maxWidth: 860,
                wordBreak: 'break-word',
              }}
            >
              {project.groomName}
            </div>
            {project.hashtag && (
              <div
                style={{
                  marginTop: 6,
                  padding: '8px 28px',
                  borderRadius: 999,
                  background: `${template.secondaryColor}26`,
                  border: `1.5px solid ${template.secondaryColor}`,
                  fontSize: 28,
                  color: template.secondaryColor,
                }}
              >
                {project.hashtag}
              </div>
            )}
          </div>
        )}

        {/* SCENE 4: ANIMATED FAMILY INVITATION MESSAGE */}
        {activeScene.kind === 'family' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 26,
              maxWidth: 840,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: template.secondaryColor,
              }}
            >
              {copy.familyHeader}
            </div>
            <div
              style={{
                width: 240,
                height: 2,
                background: template.secondaryColor,
              }}
            />
            <div
              style={{
                fontSize: 36,
                lineHeight: 1.55,
                color: template.textColor,
                padding: '12px 24px',
              }}
            >
              “
              {project.familyMessage ||
                'With the divine blessings of Lord Ganesha and our elders, we cordially invite you to celebrate the joyous union of our children.'}
              ”
            </div>

            {project.brideParents && (
              <div
                style={{
                  padding: '18px 32px',
                  borderRadius: 20,
                  background: 'rgba(0,0,0,0.16)',
                  border: `1.5px solid ${template.secondaryColor}66`,
                  width: '100%',
                }}
              >
                <div style={{ fontSize: 26, color: template.mutedTextColor }}>
                  {copy.daughterOf} ({project.brideName})
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: template.secondaryColor,
                    marginTop: 6,
                  }}
                >
                  {project.brideParents}
                </div>
              </div>
            )}

            {project.groomParents && (
              <div
                style={{
                  padding: '18px 32px',
                  borderRadius: 20,
                  background: 'rgba(0,0,0,0.16)',
                  border: `1.5px solid ${template.secondaryColor}66`,
                  width: '100%',
                }}
              >
                <div style={{ fontSize: 26, color: template.mutedTextColor }}>
                  {copy.sonOf} ({project.groomName})
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: template.secondaryColor,
                    marginTop: 6,
                  }}
                >
                  {project.groomParents}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCENES 5..N: SELECTED CEREMONY EVENTS (Reference Screenshot 2 Haldi Style) */}
        {activeScene.kind === 'ceremony' && activeScene.ceremony && (() => {
          const evt = activeScene.ceremony;
          const dParts = parseDateParts(evt.date);
          const isHaldiEvt = evt.type === 'haldi';
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                width: '100%',
              }}
            >
              <GaneshMotifSVG
                color={isHaldiEvt ? '#DC2626' : template.secondaryColor}
                size={110}
              />
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: isHaldiEvt ? '#DC2626' : template.secondaryColor,
                }}
              >
                ॥ श्री गणेशाय नमः ॥
              </div>

              <div
                style={{
                  fontSize: 34,
                  fontStyle: 'italic',
                  fontWeight: 700,
                  color: isHaldiEvt ? '#451A03' : template.textColor,
                  maxWidth: 740,
                }}
              >
                {isHaldiEvt
                  ? 'Dulha dulhan ko hai jaldi... Aao lagaye haldi'
                  : evt.customMessage || copy.ceremonyHeader}
              </div>

              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: isHaldiEvt
                    ? '#D97706'
                    : evt.type === 'mehndi'
                    ? '#059669'
                    : template.secondaryColor,
                  lineHeight: 1.15,
                }}
              >
                {evt.name}
              </div>

              {/* Iconic Split Date Block from Reference Screenshot 2 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  margin: '8px 0',
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    letterSpacing: '0.16em',
                    color: isHaldiEvt ? '#57534E' : template.mutedTextColor,
                  }}
                >
                  {dParts.monthUpper}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 28,
                  }}
                >
                  <div
                    style={{
                      borderTop: '2px solid currentColor',
                      borderBottom: '2px solid currentColor',
                      padding: '8px 24px',
                      fontSize: 32,
                      minWidth: 190,
                    }}
                  >
                    {dParts.weekday}
                  </div>
                  <div
                    style={{
                      fontSize: 78,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: isHaldiEvt ? '#451A03' : template.secondaryColor,
                    }}
                  >
                    {dParts.day}
                  </div>
                  <div
                    style={{
                      borderTop: '2px solid currentColor',
                      borderBottom: '2px solid currentColor',
                      padding: '8px 24px',
                      fontSize: 30,
                      minWidth: 190,
                    }}
                  >
                    {evt.time.split(' ')[0]} {evt.time.split(' ')[1] || ''}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 34,
                    letterSpacing: '0.1em',
                    color: isHaldiEvt ? '#57534E' : template.mutedTextColor,
                  }}
                >
                  {dParts.year}
                </div>
              </div>

              <div style={{ fontSize: 28, opacity: 0.75 }}>at</div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: isHaldiEvt ? '#3E2723' : template.textColor,
                  maxWidth: 780,
                }}
              >
                {evt.venue}
              </div>
              {evt.address && (
                <div
                  style={{
                    fontSize: 28,
                    color: isHaldiEvt ? '#78350F' : template.mutedTextColor,
                    maxWidth: 760,
                  }}
                >
                  {evt.address}
                </div>
              )}

              {/* Bottom Marigold Jhula Frame with Couple Portrait */}
              <div
                style={{
                  marginTop: 12,
                  position: 'relative',
                  paddingTop: 18,
                }}
              >
                <div
                  style={{
                    width: 420,
                    height: 22,
                    borderRadius: 999,
                    background:
                      'repeating-linear-gradient(90deg, #FACC15 0px, #FACC15 18px, #EA580C 18px, #EA580C 36px)',
                    margin: '0 auto -10px auto',
                    position: 'relative',
                    zIndex: 2,
                  }}
                />
                <FramedPhoto
                  slot={project.photos.couple}
                  size={310}
                  borderColor={isHaldiEvt ? '#D97706' : template.secondaryColor}
                  accentColor="#FDE047"
                  arch
                />
              </div>
            </div>
          );
        })()}

        {/* SCENE 8: MAIN WEDDING DATE, TIME, VENUE & PEACOCK MANDAP (Reference Screenshot 3 Style) */}
        {activeScene.kind === 'wedding-main' && (() => {
          const wParts = parseDateParts(project.weddingDate);
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                marginTop: 70,
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontStyle: 'italic',
                  fontWeight: 600,
                  color: template.textColor,
                }}
              >
                Together with our families
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontStyle: 'italic',
                  color: template.mutedTextColor,
                }}
              >
                We cordially invite you to join our wedding on
              </div>

              {/* Reference Screenshot 3 Date Row: NOV ⋮ 21 ⋮ 2026 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 32,
                  margin: '10px 0',
                }}
              >
                <div
                  style={{
                    fontSize: 44,
                    letterSpacing: '0.1em',
                    color: template.textColor,
                  }}
                >
                  {wParts.monthShort}
                </div>
                <div
                  style={{
                    height: 64,
                    borderLeft: `3px dotted ${template.secondaryColor}`,
                  }}
                />
                <div
                  style={{
                    fontSize: 92,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: template.secondaryColor,
                  }}
                >
                  {wParts.day}
                </div>
                <div
                  style={{
                    height: 64,
                    borderLeft: `3px dotted ${template.secondaryColor}`,
                  }}
                />
                <div
                  style={{
                    fontSize: 44,
                    letterSpacing: '0.08em',
                    color: template.textColor,
                  }}
                >
                  {wParts.year}
                </div>
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: template.secondaryColor,
                }}
              >
                {project.weddingTime} • At
              </div>

              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontStyle: 'italic',
                  color: template.textColor,
                  maxWidth: 820,
                }}
              >
                {project.weddingVenue}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: template.mutedTextColor,
                  maxWidth: 780,
                }}
              >
                {project.weddingAddress}
              </div>

              {/* GOLDEN DOMED WEDDING MANDAP WITH TWO PEACOCKS & SACRED HAVAN FIRE */}
              <div
                style={{
                  position: 'relative',
                  marginTop: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Left & Right Perched Peacocks */}
                <div
                  style={{
                    position: 'absolute',
                    top: -20,
                    left: -135,
                    zIndex: 3,
                  }}
                >
                  <PeacockMotif />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: -20,
                    right: -135,
                    zIndex: 3,
                  }}
                >
                  <PeacockMotif flip />
                </div>

                {/* Golden Mandap Dome SVG */}
                <svg
                  width="460"
                  height="110"
                  viewBox="0 0 460 110"
                  style={{ marginBottom: -18, zIndex: 2 }}
                >
                  <path
                    d="M30 110 C60 28, 175 18, 230 4 C285 18, 400 28, 430 110 Z"
                    fill="#FDE047"
                    stroke="#D97706"
                    strokeWidth="4"
                  />
                  {/* Marigold Toran across Mandap */}
                  <rect
                    x="20"
                    y="92"
                    width="420"
                    height="18"
                    rx="9"
                    fill="#EA580C"
                  />
                </svg>

                <FramedPhoto
                  slot={project.photos.couple}
                  size={330}
                  borderColor={template.secondaryColor}
                  accentColor={template.accentColor}
                  arch
                />

                {/* Sacred Havan Kund Fire at base of Mandap */}
                <div
                  style={{
                    marginTop: -22,
                    zIndex: 4,
                    padding: '6px 28px',
                    borderRadius: 12,
                    background: '#78350F',
                    border: '2px solid #F59E0B',
                    color: '#FEF08A',
                    fontSize: 22,
                    fontWeight: 700,
                    boxShadow: '0 6px 20px rgba(245,158,11,0.5)',
                  }}
                >
                  🔥 शुभ लग्न मंडप • Sacred Mandap 🔥
                </div>
              </div>
            </div>
          );
        })()}

        {/* SCENE 9: FINAL INVITATION MESSAGE, FAMILY NAMES & THANK YOU */}
        {activeScene.kind === 'closing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              maxWidth: 820,
            }}
          >
            {project.photos.gallery?.url && (
              <FramedPhoto
                slot={project.photos.gallery}
                size={270}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
            )}

            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: template.secondaryColor,
                lineHeight: 1.2,
              }}
            >
              {copy.closingHeader}
            </div>

            <div
              style={{
                fontSize: 34,
                color: template.textColor,
                lineHeight: 1.5,
              }}
            >
              {copy.closingMessage}
            </div>

            <div
              style={{
                padding: '24px 36px',
                borderRadius: 24,
                border: `2px solid ${template.secondaryColor}`,
                background: 'rgba(0,0,0,0.18)',
                width: '100%',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  color: template.mutedTextColor,
                  marginBottom: 8,
                }}
              >
                {copy.rsvpHeader}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: template.secondaryColor,
                }}
              >
                {project.rsvpDetails ||
                  `${project.brideName} & ${project.groomName} Families`}
              </div>
              {project.contactPhone && (
                <div
                  style={{
                    fontSize: 30,
                    color: template.textColor,
                    marginTop: 8,
                  }}
                >
                  ✆ {project.contactPhone}
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: template.secondaryColor,
                marginTop: 8,
              }}
            >
              {project.brideName} ♥ {project.groomName}
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

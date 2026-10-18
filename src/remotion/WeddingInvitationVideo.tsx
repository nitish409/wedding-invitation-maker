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

function FramedPhoto({
  slot,
  size = 420,
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
        height: arch ? size * 1.18 : size,
        borderRadius: arch ? `${size / 2}px ${size / 2}px 28px 28px` : '50%',
        border: `8px solid ${borderColor}`,
        boxShadow: `0 0 0 6px rgba(212,175,55,0.28), 0 24px 50px rgba(0,0,0,0.45)`,
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
          filter: removeBg ? 'contrast(1.08) saturate(1.1) drop-shadow(0 8px 20px rgba(0,0,0,0.4))' : 'none',
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

function GaneshMotifSVG({ color, size = 230 }: { color: string; size?: number }) {
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
      {/* Crown (Mukut) */}
      <path
        d="M70 68 L100 26 L130 68 Z"
        stroke={color}
        strokeWidth="4"
        fill={color}
        fillOpacity="0.2"
      />
      <circle cx="100" cy="22" r="6" fill={color} />
      {/* Ears */}
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
      {/* Head & Trunk (Vakratunda) */}
      <path
        d="M74 72 C74 55, 126 55, 126 72 C126 95, 112 108, 104 126 C98 140, 115 152, 124 140"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Tilak */}
      <line x1="88" y1="76" x2="112" y2="76" stroke={color} strokeWidth="3" />
      <line x1="92" y1="83" x2="108" y2="83" stroke={color} strokeWidth="3" />
      <circle cx="100" cy="91" r="4" fill={color} />
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

  // Find active scene
  const activeScene =
    scenes.find(
      (s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames
    ) || scenes[scenes.length - 1];

  const sceneFrame = Math.max(0, frame - activeScene.startFrame);
  const sceneDuration = activeScene.durationFrames;

  // Smooth fade-in and fade-out for each scene
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

  const translateY = interpolate(entranceSpring, [0, 1], [48, 0]);
  const scaleIn = interpolate(entranceSpring, [0, 1], [0.92, 1]);

  // Audio volume with fade-in (2s) and fade-out (2.5s)
  const baseVolume = project.music?.volume ?? 0.85;
  const audioEnvelope = interpolate(
    frame,
    [0, fps * 2, Math.max(fps * 2 + 1, totalFrames - fps * 2.5), totalFrames],
    [0, baseVolume, baseVolume, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const startFromFrames = Math.round((project.music?.startOffsetSec || 0) * fps);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 32%, ${template.bgColor} 0%, ${template.bgGradientEnd} 100%)`,
        color: template.textColor,
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

      {/* Rotating Background Mandala */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 980,
          height: 980,
          marginLeft: -490,
          marginTop: -490,
          transform: `rotate(${frame * 0.25}deg)`,
          opacity: 0.14,
          pointerEvents: 'none',
        }}
      >
        <svg viewBox="0 0 400 400" width="100%" height="100%">
          <circle
            cx="200"
            cy="200"
            r="190"
            stroke={template.secondaryColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 8"
          />
          <circle
            cx="200"
            cy="200"
            r="155"
            stroke={template.secondaryColor}
            strokeWidth="1.5"
            fill="none"
          />
          <circle
            cx="200"
            cy="200"
            r="115"
            stroke={template.secondaryColor}
            strokeWidth="2"
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
                  stroke={template.secondaryColor}
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Template Specific Top Header Motifs (Marigolds / Lanterns / Temple Bells) */}
      <div
        style={{
          position: 'absolute',
          top: 38,
          left: 60,
          right: 60,
          height: 110,
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const swing = Math.sin(frame * 0.08 + i) * 6;
          return (
            <div
              key={i}
              style={{
                transform: `rotate(${swing}deg)`,
                transformOrigin: 'top center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 36 + (i % 2) * 22,
                  background: template.secondaryColor,
                }}
              />
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius:
                    template.motifStyle === 'peacock-mandap'
                      ? '4px 4px 14px 14px'
                      : '50%',
                  background:
                    template.motifStyle === 'marigold'
                      ? i % 2 === 0
                        ? '#F59E0B'
                        : '#EA580C'
                      : template.secondaryColor,
                  boxShadow: `0 0 18px ${template.secondaryColor}`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Falling Petals / Golden Dust Particles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {Array.from({ length: 22 }).map((_, i) => {
          const seed = (i + 1) * 47;
          const x = ((seed * 43) % 960) + 60;
          const speed = 2.2 + (i % 4) * 0.9;
          const y = ((frame * speed + seed * 19) % 1980) - 40;
          const drift = Math.sin(frame * 0.04 + i) * 24;
          const isPetal =
            template.motifStyle === 'marigold' ||
            template.motifStyle === 'floral-arch';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x + drift,
                top: y,
                width: isPetal ? 16 : 9,
                height: isPetal ? 22 : 9,
                borderRadius: isPetal ? '60% 40% 60% 40%' : '50%',
                background:
                  template.motifStyle === 'marigold'
                    ? i % 2 === 0
                      ? '#F59E0B'
                      : '#FACC15'
                    : template.motifStyle === 'floral-arch'
                    ? '#F472B6'
                    : template.secondaryColor,
                opacity: 0.55,
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
          inset: 36,
          border: `4px solid ${template.secondaryColor}`,
          borderRadius: 28,
          boxShadow: `inset 0 0 0 10px transparent, inset 0 0 0 12px ${template.secondaryColor}66`,
          pointerEvents: 'none',
        }}
      />

      {/* Scene Content Container */}
      <AbsoluteFill
        style={{
          padding: '150px 84px 120px 84px',
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
              gap: 34,
            }}
          >
            <GaneshMotifSVG color={template.secondaryColor} size={270} />
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: template.secondaryColor,
                letterSpacing: '0.04em',
              }}
            >
              {copy.invocation}
            </div>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.5,
                color: template.mutedTextColor,
                maxWidth: 780,
              }}
            >
              {copy.invocationSub}
            </div>
            <div
              style={{
                marginTop: 24,
                padding: '12px 36px',
                borderRadius: 999,
                border: `2px solid ${template.secondaryColor}`,
                fontSize: 28,
                color: template.secondaryColor,
              }}
            >
              {template.nameHindi} • {template.name}
            </div>
          </div>
        )}

        {/* SCENE 2: SHUBH VIVAH / WEDDING INVITATION TITLE */}
        {activeScene.kind === 'title' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 28,
            }}
          >
            <div
              style={{
                fontSize: 32,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: template.secondaryColor,
              }}
            >
              {copy.invocation}
            </div>
            <div
              style={{
                fontSize: 82,
                fontWeight: 700,
                lineHeight: 1.15,
                color: template.secondaryColor,
                textShadow: '0 6px 24px rgba(0,0,0,0.28)',
                padding: '12px 0',
              }}
            >
              {copy.titleMain}
            </div>
            <div
              style={{
                width: 340,
                height: 3,
                background: template.secondaryColor,
                margin: '8px 0',
              }}
            />
            <div
              style={{
                fontSize: 38,
                lineHeight: 1.45,
                color: template.textColor,
                maxWidth: 780,
              }}
            >
              {copy.titleSub}
            </div>
            <div
              style={{
                marginTop: 32,
                fontSize: 56,
                fontWeight: 700,
                color: template.secondaryColor,
              }}
            >
              {project.brideName}
              <span
                style={{
                  display: 'block',
                  fontSize: 34,
                  fontStyle: 'italic',
                  margin: '10px 0',
                  color: template.mutedTextColor,
                }}
              >
                {copy.wedsLabel}
              </span>
              {project.groomName}
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
              gap: 24,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 36,
                marginBottom: 8,
              }}
            >
              <FramedPhoto
                slot={project.photos.bride}
                size={250}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
              <FramedPhoto
                slot={project.photos.groom}
                size={250}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
            </div>

            <FramedPhoto
              slot={project.photos.couple}
              size={380}
              borderColor={template.secondaryColor}
              accentColor={template.accentColor}
              arch
            />

            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.15,
                color: template.secondaryColor,
                marginTop: 12,
                maxWidth: 860,
                wordBreak: 'break-word',
              }}
            >
              {project.brideName}
            </div>
            <div
              style={{
                fontSize: 34,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: template.mutedTextColor,
              }}
            >
              — {copy.wedsLabel} —
            </div>
            <div
              style={{
                fontSize: 64,
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
                  marginTop: 8,
                  padding: '8px 28px',
                  borderRadius: 999,
                  background: `${template.secondaryColor}26`,
                  border: `1.5px solid ${template.secondaryColor}`,
                  fontSize: 30,
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
              gap: 28,
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

        {/* SCENES 5..N: SELECTED CEREMONY EVENTS (Haldi, Mehndi, Sangeet, etc.) */}
        {activeScene.kind === 'ceremony' && activeScene.ceremony && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '10px 32px',
                borderRadius: 999,
                border: `2px solid ${template.secondaryColor}`,
                fontSize: 28,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: template.secondaryColor,
              }}
            >
              {copy.ceremonyHeader}
            </div>

            <div
              style={{
                fontSize: 74,
                fontWeight: 700,
                color:
                  activeScene.ceremony.type === 'haldi'
                    ? '#F59E0B'
                    : activeScene.ceremony.type === 'mehndi'
                    ? '#10B981'
                    : template.secondaryColor,
                lineHeight: 1.15,
              }}
            >
              {activeScene.ceremony.name}
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: 800,
                padding: '38px 40px',
                borderRadius: 28,
                background: 'rgba(0,0,0,0.2)',
                border: `2px solid ${template.secondaryColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: template.textColor,
                }}
              >
                {formatReadableDate(activeScene.ceremony.date)}
              </div>
              <div
                style={{
                  fontSize: 36,
                  color: template.secondaryColor,
                  fontWeight: 600,
                }}
              >
                {activeScene.ceremony.time}
              </div>
              <div
                style={{
                  width: 180,
                  height: 2,
                  background: template.secondaryColor,
                  margin: '4px auto',
                }}
              />
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: template.textColor,
                }}
              >
                {activeScene.ceremony.venue}
              </div>
              {activeScene.ceremony.address && (
                <div
                  style={{
                    fontSize: 30,
                    color: template.mutedTextColor,
                    lineHeight: 1.4,
                  }}
                >
                  {activeScene.ceremony.address}
                </div>
              )}
              {activeScene.ceremony.customMessage && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '10px 24px',
                    borderRadius: 14,
                    background: `${template.secondaryColor}26`,
                    fontSize: 28,
                    color: template.secondaryColor,
                  }}
                >
                  ✦ {activeScene.ceremony.customMessage} ✦
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCENE 8: MAIN WEDDING DATE, TIME, VENUE & MANDAP */}
        {activeScene.kind === 'wedding-main' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 22,
              width: '100%',
            }}
          >
            <div
              style={{
                fontSize: 30,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: template.secondaryColor,
              }}
            >
              {copy.weddingSub}
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: template.secondaryColor,
              }}
            >
              {copy.weddingHeader}
            </div>

            <FramedPhoto
              slot={project.photos.couple}
              size={360}
              borderColor={template.secondaryColor}
              accentColor={template.accentColor}
              arch
            />

            <div
              style={{
                width: '100%',
                maxWidth: 820,
                padding: '30px 36px',
                borderRadius: 26,
                background: 'rgba(0,0,0,0.22)',
                border: `2.5px solid ${template.secondaryColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  color: template.secondaryColor,
                }}
              >
                {formatReadableDate(project.weddingDate)}
              </div>
              <div style={{ fontSize: 34, color: template.textColor }}>
                {project.weddingTime}
              </div>
              <div
                style={{
                  width: 200,
                  height: 2,
                  background: template.secondaryColor,
                  margin: '6px auto',
                }}
              />
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: template.textColor,
                }}
              >
                {project.weddingVenue}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: template.mutedTextColor,
                  lineHeight: 1.4,
                }}
              >
                {project.weddingAddress}
              </div>
            </div>
          </div>
        )}

        {/* SCENE 9: FINAL INVITATION MESSAGE, FAMILY NAMES & THANK YOU */}
        {activeScene.kind === 'closing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 26,
              maxWidth: 820,
            }}
          >
            {project.photos.gallery?.url && (
              <FramedPhoto
                slot={project.photos.gallery}
                size={280}
                borderColor={template.secondaryColor}
                accentColor={template.accentColor}
              />
            )}

            <div
              style={{
                fontSize: 54,
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
                {project.rsvpDetails || `${project.brideName} & ${project.groomName} Families`}
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
                marginTop: 10,
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

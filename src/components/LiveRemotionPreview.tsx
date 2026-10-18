'use client';

import React, { useMemo, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { WeddingInvitationVideo } from '@/remotion/WeddingInvitationVideo';
import { TemplateDefinition, WeddingProjectInput } from '@/types/wedding';
import { calculateWeddingScenes, getTemplateById } from '@/lib/video/sceneCalculator';
import { Film, Sparkles } from 'lucide-react';

interface LiveRemotionPreviewProps {
  project: WeddingProjectInput;
  customTemplates?: TemplateDefinition[];
  compact?: boolean;
}

export const LiveRemotionPreview: React.FC<LiveRemotionPreviewProps> = ({
  project,
  customTemplates,
  compact = false,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  const { scenes, totalDurationSec, totalFrames } = useMemo(
    () => calculateWeddingScenes(project, 30),
    [project]
  );

  const template = useMemo(
    () => getTemplateById(project.templateId, customTemplates),
    [project.templateId, customTemplates]
  );

  const jumpToScene = (startFrame: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(startFrame + 16);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Top Info Pill */}
      <div className="flex items-center justify-between w-full max-w-[340px] mb-2.5 px-3 py-1.5 rounded-full bg-[#3B0510] text-[#F3E5AB] border border-[#D4AF37]/40 text-xs">
        <span className="flex items-center gap-1.5 font-medium truncate">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          {template.name}
        </span>
        <span className="flex items-center gap-1 text-[#D4AF37] font-semibold shrink-0">
          <Film className="w-3.5 h-3.5" />
          {scenes.length} Scenes • {Math.round(totalDurationSec)}s
        </span>
      </div>

      {/* Vertical 9:16 Phone Mockup Frame */}
      <div
        className="relative rounded-[34px] p-2.5 bg-gradient-to-b from-[#2A040C] via-[#4A0715] to-[#1E0208] shadow-2xl border-2 border-[#D4AF37]/60"
        style={{
          width: compact ? 290 : 336,
        }}
      >
        {/* Top Speaker Notch */}
        <div className="w-20 h-1.5 bg-[#D4AF37]/35 rounded-full mx-auto mb-2" />

        <div className="rounded-[24px] overflow-hidden bg-[#240209] aspect-[9/16] w-full relative shadow-inner">
          <Player
            ref={playerRef}
            component={
              WeddingInvitationVideo as unknown as React.FC<
                Record<string, unknown>
              >
            }
            inputProps={{
              project,
              customTemplates,
            }}
            durationInFrames={Math.max(90, totalFrames)}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={30}
            style={{
              width: '100%',
              height: '100%',
            }}
            controls
            autoPlay
            loop
          />
        </div>
      </div>

      {/* Quick Scene Jumpers */}
      {!compact && (
        <div className="w-full max-w-[360px] mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5C0A1B]/75 mb-1.5 text-center">
            Jump to Animated Scene (Click to Preview):
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {scenes.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => jumpToScene(sc.startFrame)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFFDF9] hover:bg-[#5C0A1B] text-[#5C0A1B] hover:text-[#F3E5AB] border border-[#D4AF37]/50 transition shadow-sm"
              >
                {idx + 1}.{' '}
                {sc.kind === 'ganesh'
                  ? 'Ganesh Ji'
                  : sc.kind === 'title'
                  ? 'Shubh Vivah'
                  : sc.kind === 'couple'
                  ? 'Couple Photo'
                  : sc.kind === 'family'
                  ? 'Family'
                  : sc.kind === 'ceremony'
                  ? sc.ceremony?.name || 'Ceremony'
                  : sc.kind === 'wedding-main'
                  ? 'Wedding Mandap'
                  : 'RSVP & Closing'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Composition } from 'remotion';
import { WeddingInvitationVideo } from './WeddingInvitationVideo';
import { DEFAULT_PROJECT_INPUT } from '@/lib/constants/templates';
import { calculateWeddingScenes } from '@/lib/video/sceneCalculator';

export const RemotionRoot: React.FC = () => {
  const { totalFrames } = calculateWeddingScenes(DEFAULT_PROJECT_INPUT, 30);

  return (
    <>
      <Composition
        id="WeddingInvitationVideo"
        component={WeddingInvitationVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          project: DEFAULT_PROJECT_INPUT,
        }}
      />
    </>
  );
};

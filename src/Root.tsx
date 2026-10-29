import React from "react";
import { Composition } from "remotion";
import { MainVideo, type MainVideoProps } from "./MainVideo";
import { TimelineSchema, type Timeline } from "./schema";
import timelineData from "../data/timeline.json";
import captionsData from "../data/captions.json";
import { toFrames } from "./time";

const clipLen = (c: Timeline["clips"][number]) =>
  (c.trimEnd ?? c.duration) - (c.trimStart ?? 0);

export const Root: React.FC = () => {
  const initialTimeline = timelineData as unknown as Timeline;
  const initialCaptions = captionsData as unknown as { words: any[] };

  const defaultProps: MainVideoProps = {
    ...initialTimeline,
    words: initialCaptions.words,
  };

  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      schema={TimelineSchema as any}
      defaultProps={defaultProps as any}
      fps={initialTimeline.fps ?? 30}
      width={initialTimeline.width ?? 1920}
      height={initialTimeline.height ?? 1080}
      durationInFrames={300}
      calculateMetadata={({ props }) => {
        const t = props as MainVideoProps;
        const total = (t.clips || []).reduce((s, c) => s + clipLen(c), 0);
        const fps = t.fps || 30;
        return {
          durationInFrames: Math.max(1, toFrames(total, fps)),
          fps,
          width: t.width || 1920,
          height: t.height || 1080,
        };
      }}
    />
  );
};

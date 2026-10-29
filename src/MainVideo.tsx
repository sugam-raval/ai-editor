import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Audio,
  staticFile,
  useVideoConfig,
} from "remotion";
import { toFrames } from "./time";
import { Captions } from "./components/Captions";
import { overlayRegistry } from "./components/registry";
import type { Timeline, Word } from "./schema";

export interface MainVideoProps extends Timeline {
  words?: Word[];
}

/**
 * Maps source audio words to timeline time considering clip trims and sequence offsets.
 */
export function mapSourceToTimeline(words: Word[], clips: Timeline["clips"]): Word[] {
  if (!words || words.length === 0) return [];
  if (clips.length === 1 && clips[0].trimStart === 0 && clips[0].trimEnd === undefined) {
    return words;
  }

  const mappedWords: Word[] = [];
  let timelineOffset = 0;

  for (const clip of clips) {
    const start = clip.trimStart ?? 0;
    const end = clip.trimEnd ?? clip.duration;
    const clipLen = end - start;

    for (const w of words) {
      // Check if word falls inside this clip's trimmed source interval
      if (w.start >= start && w.end <= end) {
        mappedWords.push({
          text: w.text,
          start: w.start - start + timelineOffset,
          end: w.end - start + timelineOffset,
        });
      }
    }
    timelineOffset += clipLen;
  }

  return mappedWords;
}

export const MainVideo: React.FC<MainVideoProps> = ({
  clips = [],
  overlays = [],
  captionStyle = { enabled: true },
  music,
  words = [],
}) => {
  const { fps } = useVideoConfig();
  let cursor = 0;

  const timelineWords = mapSourceToTimeline(words, clips);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Video Clips laid end-to-end */}
      {clips.map((c) => {
        const len = (c.trimEnd ?? c.duration) - (c.trimStart ?? 0);
        const from = toFrames(cursor, fps);
        const durationFrames = Math.max(1, toFrames(len, fps));
        cursor += len;

        return (
          <Sequence key={c.id} from={from} durationInFrames={durationFrames}>
            <OffthreadVideo
              src={staticFile(c.src)}
              startFrom={toFrames(c.trimStart ?? 0, fps)}
              volume={c.volume ?? 1}
            />
          </Sequence>
        );
      })}

      {/* Dynamic Overlays */}
      {overlays.map((o) => {
        const Comp = overlayRegistry[o.type];
        if (!Comp) return null;
        return (
          <Sequence
            key={o.id}
            from={toFrames(o.at, fps)}
            durationInFrames={toFrames(o.duration, fps)}
          >
            <Comp {...o} />
          </Sequence>
        );
      })}

      {/* Captions */}
      {captionStyle?.enabled !== false && (
        <Captions words={timelineWords} style={captionStyle} />
      )}

      {/* Background Music */}
      {music && music.src && (
        <Audio src={staticFile(music.src)} volume={music.volume ?? 0.15} loop />
      )}
    </AbsoluteFill>
  );
};

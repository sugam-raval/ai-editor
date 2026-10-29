import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word, CaptionStyle } from "../schema";

function chunk(words: Word[], max: number): Word[][] {
  const pages: Word[][] = [];
  for (let i = 0; i < words.length; i += max) {
    pages.push(words.slice(i, i + max));
  }
  return pages;
}

export const Captions: React.FC<{ words: Word[]; style: CaptionStyle }> = ({
  words,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (!words || words.length === 0) return null;

  const pages = chunk(words, style.maxWordsPerLine ?? 6);
  const page = pages.find(
    (p) => t >= p[0].start && t <= p[p.length - 1].end + 0.25
  );
  if (!page) return null;

  const justify =
    style.position === "top"
      ? "flex-start"
      : style.position === "center"
      ? "center"
      : "flex-end";

  return (
    <AbsoluteFill
      style={{
        justifyContent: justify,
        alignItems: "center",
        padding: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: style.background ?? "rgba(0,0,0,0.55)",
          padding: "14px 28px",
          borderRadius: 16,
          fontFamily: style.fontFamily ?? "sans-serif",
          fontSize: style.fontSize ?? 56,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "80%",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        {page.map((w, i) => {
          const active = t >= w.start && t < w.end;
          const text = style.uppercase ? w.text.toUpperCase() : w.text;
          return (
            <span
              key={`${w.start}-${i}`}
              style={{
                color: active
                  ? (style.highlightColor ?? "#ffd400")
                  : (style.color ?? "#ffffff"),
                marginRight: 12,
                display: "inline-block",
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

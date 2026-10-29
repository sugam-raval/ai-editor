import React from "react";
import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const Title: React.FC<{
  text: string;
  subtitle?: string;
  color?: string;
  position?: "top" | "center" | "bottom";
  duration: number;
}> = ({ text, subtitle, color = "#ffffff", position = "center", duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const totalFrames = duration * fps;
  const exit = interpolate(frame, [totalFrames - 15, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const justify =
    position === "top"
      ? "flex-start"
      : position === "bottom"
      ? "flex-end"
      : "center";

  return (
    <AbsoluteFill
      style={{
        justifyContent: justify,
        alignItems: "center",
        padding: 100,
        pointerEvents: "none",
        opacity: exit,
      }}
    >
      <div
        style={{
          transform: `scale(${enter})`,
          textAlign: "center",
          color,
          textShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}
      >
        <h1 style={{ fontSize: 72, fontWeight: 900, margin: 0, letterSpacing: "-1px" }}>
          {text}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 36, fontWeight: 500, margin: "16px 0 0 0", opacity: 0.9 }}>
            {subtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

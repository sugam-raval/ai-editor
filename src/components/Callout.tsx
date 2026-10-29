import React from "react";
import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const Callout: React.FC<{
  text: string;
  x: number;
  y: number;
  color?: string;
  duration: number;
}> = ({ text, x, y, color = "#ff3b30", duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 15, mass: 0.5 } });
  const totalFrames = duration * fps;
  const exit = interpolate(frame, [totalFrames - 10, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) scale(${enter})`,
          opacity: exit,
          backgroundColor: color,
          color: "white",
          padding: "12px 24px",
          borderRadius: 30,
          fontWeight: 700,
          fontSize: 28,
          boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>📍</span>
        <span>{text}</span>
      </div>
    </AbsoluteFill>
  );
};

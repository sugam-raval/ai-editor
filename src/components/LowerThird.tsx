import React from "react";
import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const LowerThird: React.FC<{
  name: string;
  role?: string;
  accent?: string;
  duration: number;
}> = ({ name, role, accent = "#ffcc00", duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const totalFrames = duration * fps;
  const exit = interpolate(frame, [totalFrames - 10, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        padding: 120,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          transform: `translateX(${(1 - enter) * -400}px)`,
          opacity: exit,
          borderLeft: `8px solid ${accent}`,
          padding: "14px 28px",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          color: "white",
          width: "fit-content",
          borderRadius: "0 12px 12px 0",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.5px" }}>
          {name}
        </div>
        {role && (
          <div style={{ fontSize: 26, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>
            {role}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

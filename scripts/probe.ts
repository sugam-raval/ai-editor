import { execSync } from "node:child_process";

export interface ProbeResult {
  duration: number;
  fps: number;
  width: number;
  height: number;
}

export function probeMedia(filePath: string): ProbeResult {
  const stdout = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration -of json "${filePath}"`,
    { encoding: "utf8" }
  );

  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] || {};
  const format = data.format || {};

  const durationStr = stream.duration || format.duration || "0";
  const duration = parseFloat(durationStr);

  let fps = 30;
  if (stream.r_frame_rate) {
    const parts = stream.r_frame_rate.split("/");
    if (parts.length === 2 && parseFloat(parts[1]) > 0) {
      fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
    } else {
      fps = Math.round(parseFloat(stream.r_frame_rate)) || 30;
    }
  }

  const width = parseInt(stream.width, 10) || 1920;
  const height = parseInt(stream.height, 10) || 1080;

  return { duration, fps, width, height };
}

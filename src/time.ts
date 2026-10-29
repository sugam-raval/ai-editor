export const toFrames = (sec: number, fps: number): number => Math.round(sec * fps);

export const toSeconds = (frames: number, fps: number): number => frames / fps;

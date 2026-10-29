import { z } from "zod";

export const ClipSchema = z.object({
  id: z.string(),
  src: z.string(), // path inside /public, e.g. "footage/a.mp4"
  duration: z.number().positive(), // seconds, filled by ffprobe
  trimStart: z.number().min(0).default(0),
  trimEnd: z.number().optional(), // seconds; default = duration
  volume: z.number().min(0).max(2).default(1),
});

const Base = {
  id: z.string(),
  at: z.number().min(0), // timeline seconds
  duration: z.number().positive(),
};

export const OverlaySchema = z.discriminatedUnion("type", [
  z.object({
    ...Base,
    type: z.literal("title"),
    text: z.string(),
    subtitle: z.string().optional(),
    color: z.string().default("#ffffff"),
    position: z.enum(["top", "center", "bottom"]).default("center"),
  }),
  z.object({
    ...Base,
    type: z.literal("lowerThird"),
    name: z.string(),
    role: z.string().optional(),
    accent: z.string().default("#ffcc00"),
  }),
  z.object({
    ...Base,
    type: z.literal("callout"),
    text: z.string(),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    color: z.string().default("#ff3b30"),
  }),
]);

export const CaptionStyleSchema = z.object({
  enabled: z.boolean().default(true),
  position: z.enum(["top", "center", "bottom"]).default("bottom"),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(56),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#ffd400"),
  background: z.string().default("rgba(0,0,0,0.55)"),
  maxWordsPerLine: z.number().int().min(1).max(12).default(6),
  uppercase: z.boolean().default(false),
});

export const TimelineSchema = z.object({
  version: z.literal(1),
  fps: z.number().default(30),
  width: z.number().default(1920),
  height: z.number().default(1080),
  clips: z.array(ClipSchema).min(1),
  overlays: z.array(OverlaySchema).default([]),
  captionStyle: CaptionStyleSchema.default({}),
  music: z.object({ src: z.string(), volume: z.number().default(0.15) }).optional(),
});

export const WordSchema = z.object({
  text: z.string(),
  start: z.number(), // seconds, on the SOURCE audio
  end: z.number(),
});

export const CaptionsSchema = z.object({ words: z.array(WordSchema) });

export type Clip = z.infer<typeof ClipSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
export type Word = z.infer<typeof WordSchema>;
export type Words = z.infer<typeof CaptionsSchema>;

import { z } from "zod";
import {
  OverlaySchema,
  CaptionStyleSchema,
  TimelineSchema,
  type Timeline,
} from "../src/schema";

export const OpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_overlay"),
    overlay: OverlaySchema,
  }),
  z.object({
    op: z.literal("update_overlay"),
    id: z.string(),
    changes: z.record(z.any()),
  }),
  z.object({
    op: z.literal("remove_overlay"),
    id: z.string(),
  }),
  z.object({
    op: z.literal("set_caption_style"),
    changes: CaptionStyleSchema.partial(),
  }),
  z.object({
    op: z.literal("trim_clip"),
    id: z.string(),
    trimStart: z.number().optional(),
    trimEnd: z.number().optional(),
  }),
  z.object({
    op: z.literal("set_music"),
    src: z.string(),
    volume: z.number().optional(),
  }),
  z.object({
    op: z.literal("remove_music"),
  }),
]);

export type Op = z.infer<typeof OpSchema>;

export function applyOps(t: Timeline, ops: Op[]): Timeline {
  const next: Timeline = structuredClone(t);

  for (const o of ops) {
    switch (o.op) {
      case "add_overlay": {
        next.overlays.push(o.overlay);
        break;
      }
      case "update_overlay": {
        const i = next.overlays.findIndex((x) => x.id === o.id);
        if (i < 0) {
          throw new Error(`No overlay found with id: ${o.id}`);
        }
        next.overlays[i] = { ...next.overlays[i], ...o.changes } as any;
        break;
      }
      case "remove_overlay": {
        next.overlays = next.overlays.filter((x) => x.id !== o.id);
        break;
      }
      case "set_caption_style": {
        next.captionStyle = { ...next.captionStyle, ...o.changes };
        break;
      }
      case "trim_clip": {
        const c = next.clips.find((x) => x.id === o.id);
        if (!c) {
          throw new Error(`No clip found with id: ${o.id}`);
        }
        if (o.trimStart !== undefined) c.trimStart = o.trimStart;
        if (o.trimEnd !== undefined) c.trimEnd = o.trimEnd;
        break;
      }
      case "set_music": {
        next.music = { src: o.src, volume: o.volume ?? 0.15 };
        break;
      }
      case "remove_music": {
        delete next.music;
        break;
      }
    }
  }

  // Final schema validation ensures timeline integrity
  return TimelineSchema.parse(next);
}

import { describe, it, expect } from "vitest";
import {
  ClipSchema,
  OverlaySchema,
  CaptionStyleSchema,
  TimelineSchema,
  CaptionsSchema,
} from "../src/schema";

describe("Schema Validation", () => {
  it("validates valid clip", () => {
    const validClip = {
      id: "c1",
      src: "footage/sample.mp4",
      duration: 10,
      trimStart: 0,
      volume: 1,
    };
    const parsed = ClipSchema.parse(validClip);
    expect(parsed.id).toBe("c1");
    expect(parsed.volume).toBe(1);
  });

  it("fails on invalid clip duration", () => {
    const invalidClip = {
      id: "c1",
      src: "footage/sample.mp4",
      duration: -5,
    };
    expect(() => ClipSchema.parse(invalidClip)).toThrow();
  });

  it("validates title, lowerThird, and callout overlays", () => {
    const title = {
      id: "t1",
      type: "title",
      at: 1,
      duration: 3,
      text: "Hello World",
      position: "center",
    };
    const lowerThird = {
      id: "lt1",
      type: "lowerThird",
      at: 4,
      duration: 4,
      name: "Alice",
      role: "Presenter",
      accent: "#ff0000",
    };
    const callout = {
      id: "co1",
      type: "callout",
      at: 8,
      duration: 2,
      text: "Look here",
      x: 50,
      y: 50,
    };

    expect(OverlaySchema.parse(title).type).toBe("title");
    expect(OverlaySchema.parse(lowerThird).type).toBe("lowerThird");
    expect(OverlaySchema.parse(callout).type).toBe("callout");
  });

  it("fails on invalid overlay type", () => {
    const invalidOverlay = {
      id: "x1",
      type: "unknown_type",
      at: 1,
      duration: 2,
    };
    expect(() => OverlaySchema.parse(invalidOverlay)).toThrow();
  });

  it("validates complete timeline structure", () => {
    const timeline = {
      version: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      clips: [
        {
          id: "c1",
          src: "footage/sample.mp4",
          duration: 10,
        },
      ],
      overlays: [],
      captionStyle: {
        fontSize: 48,
        color: "#ffffff",
      },
    };
    const parsed = TimelineSchema.parse(timeline);
    expect(parsed.version).toBe(1);
    expect(parsed.clips.length).toBe(1);
  });

  it("validates captions schema", () => {
    const captions = {
      words: [
        { text: "Hello", start: 0.1, end: 0.5 },
        { text: "World", start: 0.6, end: 1.0 },
      ],
    };
    const parsed = CaptionsSchema.parse(captions);
    expect(parsed.words.length).toBe(2);
  });
});

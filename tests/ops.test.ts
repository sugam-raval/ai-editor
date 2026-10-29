import { describe, it, expect } from "vitest";
import { applyOps, type Op } from "../ai/ops";
import { TimelineSchema, type Timeline } from "../src/schema";

describe("Timeline Operations (applyOps)", () => {
  const baseTimeline: Timeline = {
    version: 1,
    fps: 30,
    width: 1920,
    height: 1080,
    clips: [
      {
        id: "c1",
        src: "footage/sample.mp4",
        duration: 20,
        trimStart: 0,
        volume: 1,
      },
    ],
    overlays: [
      {
        id: "ov_1",
        type: "title",
        at: 1,
        duration: 3,
        text: "Initial Title",
        color: "#ffffff",
        position: "center",
      },
    ],
    captionStyle: {
      enabled: true,
      position: "bottom",
      fontFamily: "Inter",
      fontSize: 56,
      color: "#ffffff",
      highlightColor: "#ffd400",
      background: "rgba(0,0,0,0.55)",
      maxWordsPerLine: 6,
      uppercase: false,
    },
  };

  it("applies add_overlay", () => {
    const ops: Op[] = [
      {
        op: "add_overlay",
        overlay: {
          id: "ov_new",
          type: "callout",
          at: 5,
          duration: 2.5,
          text: "Important point",
          x: 20,
          y: 30,
          color: "#ff3b30",
        },
      },
    ];

    const updated = applyOps(baseTimeline, ops);
    expect(updated.overlays.length).toBe(2);
    expect(updated.overlays[1].id).toBe("ov_new");
  });

  it("applies update_overlay", () => {
    const ops: Op[] = [
      {
        op: "update_overlay",
        id: "ov_1",
        changes: { text: "Updated Title Text", color: "#ffcc00" },
      },
    ];

    const updated = applyOps(baseTimeline, ops);
    const ov = updated.overlays.find((x) => x.id === "ov_1") as any;
    expect(ov.text).toBe("Updated Title Text");
    expect(ov.color).toBe("#ffcc00");
  });

  it("throws error when updating non-existent overlay", () => {
    const ops: Op[] = [
      {
        op: "update_overlay",
        id: "missing_id",
        changes: { text: "Will Fail" },
      },
    ];
    expect(() => applyOps(baseTimeline, ops)).toThrowError(/No overlay found/);
  });

  it("applies remove_overlay", () => {
    const ops: Op[] = [
      {
        op: "remove_overlay",
        id: "ov_1",
      },
    ];

    const updated = applyOps(baseTimeline, ops);
    expect(updated.overlays.length).toBe(0);
  });

  it("applies set_caption_style", () => {
    const ops: Op[] = [
      {
        op: "set_caption_style",
        changes: {
          highlightColor: "#00ffcc",
          fontSize: 64,
          uppercase: true,
        },
      },
    ];

    const updated = applyOps(baseTimeline, ops);
    expect(updated.captionStyle.highlightColor).toBe("#00ffcc");
    expect(updated.captionStyle.fontSize).toBe(64);
    expect(updated.captionStyle.uppercase).toBe(true);
  });

  it("applies trim_clip", () => {
    const ops: Op[] = [
      {
        op: "trim_clip",
        id: "c1",
        trimStart: 2,
        trimEnd: 15,
      },
    ];

    const updated = applyOps(baseTimeline, ops);
    expect(updated.clips[0].trimStart).toBe(2);
    expect(updated.clips[0].trimEnd).toBe(15);
  });

  it("applies set_music and remove_music", () => {
    const setMusicOp: Op[] = [
      {
        op: "set_music",
        src: "music/bg.mp3",
        volume: 0.25,
      },
    ];
    const withMusic = applyOps(baseTimeline, setMusicOp);
    expect(withMusic.music?.src).toBe("music/bg.mp3");
    expect(withMusic.music?.volume).toBe(0.25);

    const removeMusicOp: Op[] = [{ op: "remove_music" }];
    const withoutMusic = applyOps(withMusic, removeMusicOp);
    expect(withoutMusic.music).toBeUndefined();
  });
});

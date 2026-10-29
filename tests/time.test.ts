import { describe, it, expect } from "vitest";
import { toFrames, toSeconds } from "../src/time";
import { mapSourceToTimeline } from "../src/MainVideo";
import type { Word, Timeline } from "../src/schema";

describe("Time and Frame Utilities", () => {
  it("converts seconds to frames correctly", () => {
    expect(toFrames(1, 30)).toBe(30);
    expect(toFrames(0.5, 30)).toBe(15);
    expect(toFrames(1.5, 60)).toBe(90);
  });

  it("converts frames to seconds correctly", () => {
    expect(toSeconds(30, 30)).toBe(1);
    expect(toSeconds(15, 30)).toBe(0.5);
    expect(toSeconds(90, 60)).toBe(1.5);
  });

  it("maps source words to timeline when trimmed", () => {
    const clips: Timeline["clips"] = [
      {
        id: "c1",
        src: "footage/sample.mp4",
        duration: 10,
        trimStart: 2, // cut first 2 seconds
        trimEnd: 6, // keep 2s -> 6s (length: 4s)
        volume: 1,
      },
    ];

    const words: Word[] = [
      { text: "DiscardedEarly", start: 0.5, end: 1.0 }, // outside (< 2)
      { text: "KeptWord1", start: 2.2, end: 2.8 }, // inside -> mapped to (0.2, 0.8)
      { text: "KeptWord2", start: 3.5, end: 4.0 }, // inside -> mapped to (1.5, 2.0)
      { text: "DiscardedLate", start: 7.0, end: 8.0 }, // outside (> 6)
    ];

    const mapped = mapSourceToTimeline(words, clips);
    expect(mapped.length).toBe(2);
    expect(mapped[0].text).toBe("KeptWord1");
    expect(mapped[0].start).toBeCloseTo(0.2);
    expect(mapped[0].end).toBeCloseTo(0.8);
    expect(mapped[1].text).toBe("KeptWord2");
    expect(mapped[1].start).toBeCloseTo(1.5);
  });
});

import { describe, it, expect } from "vitest";
import { alignScript, norm } from "../scripts/align";
import type { Word } from "../src/schema";

describe("Needleman-Wunsch Script Alignment", () => {
  it("normalizes words properly", () => {
    expect(norm("Hello,")).toBe("hello");
    expect(norm("WORLD!!!")).toBe("world");
    expect(norm("ai-driven")).toBe("aidriven");
  });

  it("aligns exact matching words", () => {
    const script = "Welcome to the video editor";
    const heard: Word[] = [
      { text: "welcome", start: 0.1, end: 0.4 },
      { text: "to", start: 0.5, end: 0.7 },
      { text: "the", start: 0.8, end: 0.9 },
      { text: "video", start: 1.0, end: 1.4 },
      { text: "editor", start: 1.5, end: 1.9 },
    ];

    const aligned = alignScript(script, heard);
    expect(aligned.length).toBe(5);
    expect(aligned.map((w) => w.text)).toEqual([
      "Welcome",
      "to",
      "the",
      "video",
      "editor",
    ]);
    expect(aligned[0].start).toBe(0.1);
    expect(aligned[4].end).toBe(1.9);
  });

  it("handles ad-libs and noise in heard speech (drops ad-libs)", () => {
    const script = "Create amazing videos";
    const heard: Word[] = [
      { text: "um", start: 0.1, end: 0.3 }, // ad-lib
      { text: "create", start: 0.4, end: 0.8 },
      { text: "like", start: 0.9, end: 1.0 }, // ad-lib
      { text: "amazing", start: 1.1, end: 1.5 },
      { text: "videos", start: 1.6, end: 2.0 },
    ];

    const aligned = alignScript(script, heard);
    expect(aligned.length).toBe(3);
    expect(aligned.map((w) => w.text)).toEqual(["Create", "amazing", "videos"]);
    expect(aligned[0].start).toBe(0.4);
    expect(aligned[2].end).toBe(2.0);
  });

  it("interpolates timestamps for missing words and preserves monotonic timing", () => {
    const script = "One two three four five";
    const heard: Word[] = [
      { text: "one", start: 1.0, end: 1.5 },
      // "two" and "three" missing from heard
      { text: "four", start: 4.0, end: 4.5 },
      { text: "five", start: 5.0, end: 5.5 },
    ];

    const aligned = alignScript(script, heard);
    expect(aligned.length).toBe(5);
    expect(aligned[0].text).toBe("One");
    expect(aligned[1].text).toBe("two");
    expect(aligned[2].text).toBe("three");
    expect(aligned[3].text).toBe("four");
    expect(aligned[4].text).toBe("five");

    // Monotonicity assertion: start[i] <= end[i] and start[i] <= start[i+1]
    for (let i = 0; i < aligned.length; i++) {
      expect(aligned[i].start).toBeLessThanOrEqual(aligned[i].end);
      if (i < aligned.length - 1) {
        expect(aligned[i].start).toBeLessThanOrEqual(aligned[i + 1].start);
      }
    }
  });
});

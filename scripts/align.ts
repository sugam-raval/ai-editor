import fs from "node:fs";
import { CaptionsSchema, type Word } from "../src/schema";

export const norm = (s: string): string =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function alignScript(scriptText: string, heard: Word[]): Word[] {
  const script = scriptText.split(/\s+/).filter(Boolean);
  if (script.length === 0) return [];
  if (!heard || heard.length === 0) {
    // If no audio timings available, assign default 0.3s per word
    return script.map((w, idx) => ({
      text: w,
      start: idx * 0.3,
      end: (idx + 1) * 0.3,
    }));
  }

  const A = script.map(norm);
  const B = heard.map((w) => norm(w.text));
  const n = A.length;
  const m = B.length;

  // DP: match=0 cost, mismatch=1, gap=1
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchCost = A[i - 1] === B[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + matchCost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      );
    }
  }

  // Traceback: map each script index -> heard index (or -1)
  const map: number[] = new Array(n).fill(-1);
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    const isSame = A[i - 1] === B[j - 1];
    const matchCost = isSame ? 0 : 1;

    if (dp[i][j] === dp[i - 1][j - 1] + matchCost) {
      if (isSame) {
        map[i - 1] = j - 1;
      }
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }

  // Build timed words; interpolate gaps
  const out: (Word | null)[] = script.map((t, k) =>
    map[k] >= 0
      ? { text: t, start: heard[map[k]].start, end: heard[map[k]].end }
      : null
  );

  const lastEnd = heard[heard.length - 1]?.end ?? heard.length * 0.5;

  for (let k = 0; k < n; ) {
    if (out[k]) {
      k++;
      continue;
    }
    let s = k;
    while (k < n && !out[k]) k++;
    const prevEnd = s > 0 ? out[s - 1]!.end : 0;
    const nextStart = k < n ? out[k]!.start : Math.max(lastEnd, prevEnd + (k - s) * 0.3);
    const step = (nextStart - prevEnd) / (k - s);

    for (let q = s; q < k; q++) {
      out[q] = {
        text: script[q],
        start: Number((prevEnd + step * (q - s)).toFixed(3)),
        end: Number((prevEnd + step * (q - s + 1)).toFixed(3)),
      };
    }
  }

  return out as Word[];
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith("align.ts")) {
  const scriptPath = process.argv[2] || "data/script.txt";
  const wordsPath = process.argv[3] || "data/whisper-words.json";
  const outPath = process.argv[4] || "data/captions.json";

  const script = fs.readFileSync(scriptPath, "utf8");
  const heard = JSON.parse(fs.readFileSync(wordsPath, "utf8")).words;
  const aligned = alignScript(script, heard);
  fs.writeFileSync(
    outPath,
    JSON.stringify(CaptionsSchema.parse({ words: aligned }), null, 2)
  );
  console.log(`Aligned ${aligned.length} words to ${outPath}`);
}

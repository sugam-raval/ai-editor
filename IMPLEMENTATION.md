# AI-Driven Video Editor: Implementation Guide

**Stack:** Remotion + Whisper + FFmpeg + Claude API
**Goal:** Take raw footage and a script, auto-generate synced captions and motion graphics, and later let anyone change the edit by typing a prompt.

This document is the single source of truth. Build in the order given. Each phase has a clear "done when" check.

---

## 1. Principles

1. **Everything is data.** The video is a pure function of `timeline.json` + `captions.json` + footage. No edit lives only in code.
2. **Components are dumb.** They take validated props and render. They never fetch or decide.
3. **AI edits data, not code.** The AI returns small, validated operations on the timeline. This is what makes prompt-based editing safe and instant.
4. **Validate at every boundary** with Zod: ingest, AI output, render.
5. **Time is stored in seconds**, converted to frames only inside components (`Math.round(sec * fps)`).

---

## 2. Technology

| Concern | Tool | Cost |
|---|---|---|
| Motion graphics, composition, render | Remotion (React + TypeScript) | Free for individuals and teams up to 3; larger for-profit teams need a license (check remotion.pro) |
| Speech-to-text, word timestamps | whisper.cpp via `@remotion/install-whisper-cpp` | Free, local |
| Audio extraction, probing, proxies | FFmpeg / ffprobe | Free |
| Schema validation | Zod | Free |
| Live preview | Remotion Studio, then `@remotion/player` in a web app | Free |
| AI edit layer | Claude API (tool use) | Pay per token |
| Optional cloud render | Remotion Lambda | AWS usage only; skip for now |

**Prerequisites:** Node 18+, FFmpeg on PATH (`ffmpeg -version`), 8 GB+ RAM, an Anthropic API key in `.env`.

---

## 3. Architecture

```
 footage.mp4 + script.txt
        │
        ▼
 ┌──────────────── INGEST (Node scripts) ────────────────┐
 │ 1. ffprobe        → duration, fps, size               │
 │ 2. ffmpeg         → audio.wav (16 kHz mono)           │
 │ 3. whisper.cpp    → raw word timestamps               │
 │ 4. align script   → captions.json (script text + times)│
 │ 5. scaffold       → timeline.json (v1 draft)          │
 └───────────────────────────────────────────────────────┘
        │
        ▼
 timeline.json + captions.json
        │
        ├──────────► Remotion composition ──► Studio / Player (preview)
        │                                  └► `remotion render` → MP4
        ▲
        │  validated operations
 ┌──────┴─────── AI EDIT LAYER ──────────┐
 │ user prompt + current timeline        │
 │ → Claude (tool use) → ops[] → apply   │
 │ → Zod validate → save → hot reload    │
 └───────────────────────────────────────┘
```

---

## 4. Project Structure

```
video-editor/
├─ .env                       # ANTHROPIC_API_KEY=...
├─ package.json
├─ remotion.config.ts
├─ public/
│  └─ footage/                # source videos, audio, images, fonts
├─ data/
│  ├─ script.txt
│  ├─ captions.json           # generated
│  ├─ timeline.json           # source of truth for the edit
│  └─ history/                # timeline snapshots for undo
├─ scripts/
│  ├─ ingest.ts               # runs the whole ingest pipeline
│  ├─ transcribe.ts
│  ├─ align.ts
│  └─ render.ts
├─ src/
│  ├─ index.ts                # registerRoot
│  ├─ Root.tsx                # <Composition> with calculateMetadata
│  ├─ schema.ts               # Zod schemas (shared by everything)
│  ├─ time.ts                 # sec↔frame helpers
│  ├─ MainVideo.tsx
│  └─ components/
│     ├─ Captions.tsx
│     ├─ Title.tsx
│     ├─ LowerThird.tsx
│     ├─ Callout.tsx
│     └─ registry.ts          # overlay type → component map
├─ ai/
│  ├─ ops.ts                  # operation schemas + applyOps()
│  ├─ tools.ts                # Claude tool definitions
│  ├─ edit.ts                 # prompt → ops → new timeline
│  └─ systemPrompt.md
└─ editor/                    # Phase 6: web UI (Player + chat panel)
```

---

## 5. Setup

```bash
npx create-video@latest video-editor     # choose the Blank template, TypeScript
cd video-editor

npm i zod @remotion/captions @remotion/install-whisper-cpp \
      @remotion/transitions @remotion/google-fonts @remotion/zod-types
npm i @anthropic-ai/sdk dotenv fast-glob
npm i -D tsx @types/node
```

Use the Zod version your Remotion version documents (Remotion pins a specific Zod 3.x for Studio props editing). Run `npx remotion versions` and keep all `@remotion/*` packages on the same version.

**Done when:** `npx remotion studio` opens with the blank composition.

---

## 6. Phase 1: Schema (the contract)

`src/schema.ts`

```ts
import { z } from "zod";

export const ClipSchema = z.object({
  id: z.string(),
  src: z.string(),                       // path inside /public, e.g. "footage/a.mp4"
  duration: z.number().positive(),       // seconds, filled by ffprobe
  trimStart: z.number().min(0).default(0),
  trimEnd: z.number().optional(),        // seconds; default = duration
  volume: z.number().min(0).max(2).default(1),
});

const Base = {
  id: z.string(),
  at: z.number().min(0),                 // timeline seconds
  duration: z.number().positive(),
};

export const OverlaySchema = z.discriminatedUnion("type", [
  z.object({ ...Base, type: z.literal("title"),
    text: z.string(), subtitle: z.string().optional(),
    color: z.string().default("#ffffff"),
    position: z.enum(["top", "center", "bottom"]).default("center") }),
  z.object({ ...Base, type: z.literal("lowerThird"),
    name: z.string(), role: z.string().optional(),
    accent: z.string().default("#ffcc00") }),
  z.object({ ...Base, type: z.literal("callout"),
    text: z.string(), x: z.number().min(0).max(100), y: z.number().min(0).max(100),
    color: z.string().default("#ff3b30") }),
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
  start: z.number(),                     // seconds, on the SOURCE audio
  end: z.number(),
});
export const CaptionsSchema = z.object({ words: z.array(WordSchema) });

export type Timeline = z.infer<typeof TimelineSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
export type Words = z.infer<typeof CaptionsSchema>;
```

`src/time.ts`

```ts
export const toFrames = (sec: number, fps: number) => Math.round(sec * fps);
```

**Done when:** a hand-written `timeline.json` passes `TimelineSchema.parse()`.

---

## 7. Phase 2: Ingest Pipeline (footage + script → captions)

### 7.1 Probe and extract audio

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 public/footage/a.mp4
ffmpeg -y -i public/footage/a.mp4 -ar 16000 -ac 1 -c:a pcm_s16le data/audio.wav
```

Whisper needs 16 kHz mono WAV.

### 7.2 Transcribe with word timestamps

`scripts/transcribe.ts`

```ts
import path from "node:path";
import fs from "node:fs";
import {
  installWhisperCpp, downloadWhisperModel, transcribe, toCaptions,
} from "@remotion/install-whisper-cpp";

const whisperPath = path.join(process.cwd(), "whisper.cpp");
const WHISPER_VERSION = "1.5.5";
const MODEL = "medium.en";               // use "medium" for multilingual; "small" if slow

await installWhisperCpp({ to: whisperPath, version: WHISPER_VERSION });
await downloadWhisperModel({ model: MODEL, folder: whisperPath });

const out = await transcribe({
  inputPath: "data/audio.wav",
  whisperPath,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput: out });
const words = captions
  .map((c) => ({ text: c.text.trim(), start: c.startMs / 1000, end: c.endMs / 1000 }))
  .filter((w) => w.text.length > 0);

fs.writeFileSync("data/whisper-words.json", JSON.stringify({ words }, null, 2));
```

Check the current `@remotion/install-whisper-cpp` docs for the recommended `WHISPER_VERSION` and model names, since they change between releases.

Hindi, Gujarati, or other languages: use a multilingual model (`medium` or `large-v3`) and set `language` where supported. English-only `.en` models will fail on them.

### 7.3 Align the script to the audio (the "matches the script" requirement)

Whisper makes small spelling and word errors. Since you have the exact script, keep **script text** and borrow only **Whisper timings**.

Algorithm:
1. Normalize both sides (lowercase, strip punctuation).
2. Run a word-level edit-distance alignment (Needleman-Wunsch).
3. Matched pairs: script word gets Whisper's start/end.
4. Unmatched script words: interpolate evenly between the nearest timed neighbours.
5. Whisper-only words (ad-libs not in the script): dropped.

`scripts/align.ts`

```ts
import fs from "node:fs";
import { CaptionsSchema } from "../src/schema";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

type W = { text: string; start: number; end: number };

export function alignScript(scriptText: string, heard: W[]): W[] {
  const script = scriptText.split(/\s+/).filter(Boolean);
  const A = script.map(norm);
  const B = heard.map((w) => norm(w.text));
  const n = A.length, m = B.length;

  // DP: match=0 cost, mismatch=1, gap=1
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1),
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
      );

  // Traceback: map each script index → heard index (or -1)
  const map = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const same = A[i - 1] === B[j - 1];
    if (dp[i][j] === dp[i - 1][j - 1] + (same ? 0 : 1)) {
      if (same) map[i - 1] = j - 1;
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }

  // Build timed words; interpolate gaps
  const out: (W | null)[] = script.map((t, k) =>
    map[k] >= 0 ? { text: t, start: heard[map[k]].start, end: heard[map[k]].end } : null,
  );

  const lastEnd = heard[heard.length - 1]?.end ?? 0;
  for (let k = 0; k < n; ) {
    if (out[k]) { k++; continue; }
    let s = k; while (k < n && !out[k]) k++;
    const prevEnd = s > 0 ? out[s - 1]!.end : 0;
    const nextStart = k < n ? out[k]!.start : lastEnd;
    const step = (nextStart - prevEnd) / (k - s);
    for (let q = s; q < k; q++)
      out[q] = { text: script[q], start: prevEnd + step * (q - s), end: prevEnd + step * (q - s + 1) };
  }
  return out as W[];
}

// CLI
const script = fs.readFileSync("data/script.txt", "utf8");
const heard = JSON.parse(fs.readFileSync("data/whisper-words.json", "utf8")).words;
const aligned = alignScript(script, heard);
fs.writeFileSync("data/captions.json", JSON.stringify(CaptionsSchema.parse({ words: aligned }), null, 2));
```

If no script is given, copy `whisper-words.json` to `captions.json` as-is.

### 7.4 Scaffold the first timeline

`scripts/ingest.ts` runs 7.1 to 7.3, then writes a starting `data/timeline.json`:

```json
{
  "version": 1, "fps": 30, "width": 1920, "height": 1080,
  "clips": [{ "id": "c1", "src": "footage/a.mp4", "duration": 62.4, "trimStart": 0, "volume": 1 }],
  "overlays": [],
  "captionStyle": {}
}
```

Set `duration`, `width`, `height`, `fps` from ffprobe. Add to `package.json`: `"ingest": "tsx scripts/ingest.ts"`.

**Done when:** `npm run ingest` produces `captions.json` whose words match your script text, and spot-checking five words shows timings within ~150 ms.

---

## 8. Phase 3: Remotion Composition and Components

### 8.1 Root with dynamic duration

`src/Root.tsx`

```tsx
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { TimelineSchema, type Timeline } from "./schema";
import timeline from "../data/timeline.json";
import captions from "../data/captions.json";
import { toFrames } from "./time";

const clipLen = (c: Timeline["clips"][number]) => (c.trimEnd ?? c.duration) - c.trimStart;

export const Root = () => (
  <Composition
    id="MainVideo"
    component={MainVideo}
    schema={TimelineSchema}
    defaultProps={{ ...(timeline as Timeline), words: (captions as any).words } as any}
    fps={30} width={1920} height={1080} durationInFrames={300}
    calculateMetadata={({ props }) => {
      const t = props as Timeline;
      const total = t.clips.reduce((s, c) => s + clipLen(c), 0);
      return {
        durationInFrames: Math.max(1, toFrames(total, t.fps)),
        fps: t.fps, width: t.width, height: t.height,
      };
    }}
  />
);
```

(Pass `words` into the schema too, or load captions inside `MainVideo`. Keep one approach consistently.)

### 8.2 Main composition

`src/MainVideo.tsx`

```tsx
import { AbsoluteFill, Sequence, OffthreadVideo, Audio, staticFile, useVideoConfig } from "remotion";
import { toFrames } from "./time";
import { Captions } from "./components/Captions";
import { overlayRegistry } from "./components/registry";

export const MainVideo: React.FC<any> = ({ clips, overlays, captionStyle, music, words }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Footage, laid end to end */}
      {clips.map((c: any) => {
        const len = (c.trimEnd ?? c.duration) - c.trimStart;
        const from = toFrames(cursor, fps);
        cursor += len;
        return (
          <Sequence key={c.id} from={from} durationInFrames={toFrames(len, fps)}>
            <OffthreadVideo
              src={staticFile(c.src)}
              startFrom={toFrames(c.trimStart, fps)}
              volume={c.volume}
            />
          </Sequence>
        );
      })}

      {/* Overlays */}
      {overlays.map((o: any) => {
        const Comp = overlayRegistry[o.type as keyof typeof overlayRegistry];
        return (
          <Sequence key={o.id} from={toFrames(o.at, fps)} durationInFrames={toFrames(o.duration, fps)}>
            <Comp {...o} />
          </Sequence>
        );
      })}

      {/* Captions */}
      {captionStyle.enabled && <Captions words={words} style={captionStyle} />}

      {music && <Audio src={staticFile(music.src)} volume={music.volume} loop />}
    </AbsoluteFill>
  );
};
```

Note: caption word times are in **source** audio time. For a single untrimmed clip they equal timeline time. If you trim or reorder clips, add a `mapSourceToTimeline()` helper that offsets words by each clip's `trimStart` and its timeline position, and drops words outside the kept range. Build this before supporting multi-clip edits.

### 8.3 Captions component (word highlight)

`src/components/Captions.tsx`

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type Word = { text: string; start: number; end: number };

function chunk(words: Word[], max: number): Word[][] {
  const pages: Word[][] = [];
  for (let i = 0; i < words.length; i += max) pages.push(words.slice(i, i + max));
  return pages;
}

export const Captions: React.FC<{ words: Word[]; style: any }> = ({ words, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const pages = chunk(words, style.maxWordsPerLine);
  const page = pages.find((p) => t >= p[0].start && t <= p[p.length - 1].end + 0.25);
  if (!page) return null;

  const justify =
    style.position === "top" ? "flex-start" : style.position === "center" ? "center" : "flex-end";

  return (
    <AbsoluteFill style={{ justifyContent: justify, alignItems: "center", padding: 80 }}>
      <div style={{
        background: style.background, padding: "14px 28px", borderRadius: 16,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: 700,
        textAlign: "center", maxWidth: "80%",
      }}>
        {page.map((w, i) => {
          const active = t >= w.start && t < w.end;
          const text = style.uppercase ? w.text.toUpperCase() : w.text;
          return (
            <span key={i} style={{ color: active ? style.highlightColor : style.color, marginRight: 12 }}>
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

For long videos, replace `find` with a binary search over pages. Load fonts with `@remotion/google-fonts` and `waitUntilDone()`.

### 8.4 Overlay components

Each uses `spring()` for entry and `interpolate()` for exit. Example:

`src/components/LowerThird.tsx`

```tsx
import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const LowerThird: React.FC<{ name: string; role?: string; accent: string; duration: number }> =
({ name, role, accent, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [duration * fps - 10, duration * fps], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 120 }}>
      <div style={{
        transform: `translateX(${(1 - enter) * -400}px)`, opacity: exit,
        borderLeft: `8px solid ${accent}`, padding: "12px 24px",
        background: "rgba(0,0,0,0.7)", color: "white", width: "fit-content",
      }}>
        <div style={{ fontSize: 48, fontWeight: 700 }}>{name}</div>
        {role && <div style={{ fontSize: 30, opacity: 0.8 }}>{role}</div>}
      </div>
    </AbsoluteFill>
  );
};
```

Build `Title` and `Callout` the same way, then register:

`src/components/registry.ts`

```ts
import { Title } from "./Title";
import { LowerThird } from "./LowerThird";
import { Callout } from "./Callout";
export const overlayRegistry = { title: Title, lowerThird: LowerThird, callout: Callout } as const;
```

**Adding a new component later:** (1) add a schema variant in `OverlaySchema`, (2) write the component, (3) register it, (4) add it to the AI tool list. Nothing else changes.

**Done when:** `npx remotion studio` shows footage, synced word-highlight captions, and a lower third at the timestamp set in `timeline.json`.

---

## 9. Phase 4: Preview and Render

```bash
npx remotion studio                                   # live preview
npx remotion render src/index.ts MainVideo out/final.mp4 --props=data/timeline.json
```

If `words` is not part of the timeline file, load `captions.json` inside the composition instead, or merge both into one props file before rendering.

Tips:
- Use `--concurrency` to tune CPU use; use `--codec=h264` for general delivery.
- For heavy 4K source, generate a 720p proxy with FFmpeg for preview, and swap to the original at render time.
- Keep `<OffthreadVideo>` (not `<Video>`) for frame-accurate renders.

**Done when:** `out/final.mp4` plays with correct sync and audio.

---

## 10. Phase 5: AI Layer (prompt → changes)

### 10.1 Design

The AI never writes React. It returns **operations** from a closed set. Each operation is validated, applied to the timeline, the whole timeline is re-validated, and only then saved.

`ai/ops.ts`

```ts
import { z } from "zod";
import { OverlaySchema, CaptionStyleSchema, TimelineSchema, type Timeline } from "../src/schema";

export const OpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_overlay"), overlay: OverlaySchema }),
  z.object({ op: z.literal("update_overlay"), id: z.string(), changes: z.record(z.any()) }),
  z.object({ op: z.literal("remove_overlay"), id: z.string() }),
  z.object({ op: z.literal("set_caption_style"), changes: CaptionStyleSchema.partial() }),
  z.object({ op: z.literal("trim_clip"), id: z.string(), trimStart: z.number().optional(), trimEnd: z.number().optional() }),
  z.object({ op: z.literal("set_music"), src: z.string(), volume: z.number().optional() }),
  z.object({ op: z.literal("remove_music") }),
]);
export type Op = z.infer<typeof OpSchema>;

export function applyOps(t: Timeline, ops: Op[]): Timeline {
  const next: Timeline = structuredClone(t);
  for (const o of ops) {
    switch (o.op) {
      case "add_overlay": next.overlays.push(o.overlay); break;
      case "update_overlay": {
        const i = next.overlays.findIndex((x) => x.id === o.id);
        if (i < 0) throw new Error(`No overlay ${o.id}`);
        next.overlays[i] = { ...next.overlays[i], ...o.changes } as any; break;
      }
      case "remove_overlay": next.overlays = next.overlays.filter((x) => x.id !== o.id); break;
      case "set_caption_style": next.captionStyle = { ...next.captionStyle, ...o.changes }; break;
      case "trim_clip": {
        const c = next.clips.find((x) => x.id === o.id);
        if (!c) throw new Error(`No clip ${o.id}`);
        if (o.trimStart !== undefined) c.trimStart = o.trimStart;
        if (o.trimEnd !== undefined) c.trimEnd = o.trimEnd;
        break;
      }
      case "set_music": next.music = { src: o.src, volume: o.volume ?? 0.15 }; break;
      case "remove_music": delete next.music; break;
    }
  }
  return TimelineSchema.parse(next);       // final safety net
}
```

### 10.2 Claude call with tool use

`ai/edit.ts`

```ts
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import { z } from "zod";
import { OpSchema, applyOps } from "./ops";
import { TimelineSchema, type Timeline } from "../src/schema";

const client = new Anthropic();            // reads ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";   // confirm current ID in Anthropic docs

const system = fs.readFileSync("ai/systemPrompt.md", "utf8");

const tools = [{
  name: "apply_edits",
  description: "Apply one or more edit operations to the video timeline.",
  input_schema: {
    type: "object" as const,
    properties: {
      ops: { type: "array", items: { type: "object" }, description: "List of operations; see system prompt for the exact shapes." },
      summary: { type: "string", description: "One sentence describing what changed." },
    },
    required: ["ops", "summary"],
  },
}];

export async function editTimeline(prompt: string, timeline: Timeline, words: any[]) {
  const context = {
    timeline,
    transcript: words.map((w) => `${w.text}@${w.start.toFixed(2)}`).join(" "),
  };

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools,
      tool_choice: { type: "tool", name: "apply_edits" },
      messages: [{
        role: "user",
        content: `CURRENT STATE:\n${JSON.stringify(context)}\n\nREQUEST: ${prompt}` +
                 (lastError ? `\n\nYour previous attempt failed validation: ${lastError}\nFix it.` : ""),
      }],
    });

    const block = res.content.find((b) => b.type === "tool_use") as any;
    try {
      const ops = z.array(OpSchema).parse(block.input.ops);
      const next = applyOps(timeline, ops);
      return { timeline: next, summary: block.input.summary as string };
    } catch (e: any) {
      lastError = String(e.message).slice(0, 800);
    }
  }
  throw new Error("AI edit failed validation after 3 attempts: " + lastError);
}
```

### 10.3 System prompt

`ai/systemPrompt.md` (starter; extend as components grow)

```md
You edit a video timeline by calling apply_edits with operations. You never output anything else.

Rules:
- Times are in seconds on the final timeline. The transcript gives word@time.
- To place something "when X is said", find that word in the transcript and use its time.
- Never invent clip ids or overlay ids. Use ids from the current state. New overlays get ids like "ov_<short>".
- Prefer update_overlay over remove+add. Make the smallest change that satisfies the request.
- Overlay duration defaults: title 3s, lowerThird 4s, callout 2.5s.
- Colors are CSS strings. Keep captions readable (contrast against video).
- If the request is ambiguous, choose the most reasonable interpretation and say so in `summary`.

Operations (exact shapes):
- {"op":"add_overlay","overlay":{ "id","type","at","duration", ...type fields }}
    types: title{text,subtitle?,color?,position?}, lowerThird{name,role?,accent?}, callout{text,x,y,color?}
- {"op":"update_overlay","id","changes":{...}}
- {"op":"remove_overlay","id"}
- {"op":"set_caption_style","changes":{enabled?,position?,fontFamily?,fontSize?,color?,highlightColor?,background?,maxWordsPerLine?,uppercase?}}
- {"op":"trim_clip","id","trimStart?","trimEnd?"}
- {"op":"set_music","src","volume?"} / {"op":"remove_music"}
```

### 10.4 Example prompts → ops

| Prompt | Result |
|---|---|
| "Make captions yellow and bigger" | `set_caption_style {highlightColor, fontSize}` |
| "Add a title 'Quick Hub' at 0:12 for 3 seconds" | `add_overlay title` |
| "Show a lower third with my name when I say 'welcome'" | transcript lookup → `add_overlay lowerThird` |
| "Move captions to the top" | `set_caption_style {position:"top"}` |
| "Cut the first 5 seconds" | `trim_clip {trimStart: 5}` |
| "Remove the callout" | `remove_overlay` |

### 10.5 Undo and history

Before saving any AI edit, write the previous timeline to `data/history/<timestamp>.json`. Undo = restore the latest snapshot.

### 10.6 Safety rules

- Keep the API key server-side only. Never ship it in the browser bundle.
- Whitelist asset paths (`src` must start with `footage/`, `music/`, etc.).
- Cap overlay count and duration to prevent absurd outputs.
- Treat text inside the transcript or script as data, not instructions.

**Done when:** `npx tsx ai/cli.ts "add a title Quick Hub at 12 seconds"` updates `timeline.json` and Studio hot-reloads with the title.

---

## 11. Phase 6: Web Editor (prompt box + live preview)

Create `editor/` as a Vite or Next.js app.

- **Left:** `<Player>` from `@remotion/player`, using the same `MainVideo` component and `calculateMetadata` logic. It re-renders instantly when `timeline` state changes.
- **Right:** chat panel. User types a prompt, and the client calls `POST /api/edit` with `{ prompt, timeline }`.
- **Server route:** runs `editTimeline()`, returns `{ timeline, summary }`. Client sets state, shows the summary, and enables an Undo button.
- **Export button:** calls a server route that runs `renderMedia()` from `@remotion/renderer` and streams back the MP4 (or a link).
- **Optional:** a JSON/props panel (Zod-driven) for manual tweaks beside the chat.

**Done when:** you type a prompt, see the change in the Player within a few seconds, and can undo and export.

---

## 12. Phase 7: Intelligence Upgrades (after the core works)

1. **Auto-direct from script:** Claude reads script + transcript and proposes titles, lower thirds, callouts, emphasis words, and b-roll slots in one pass. Present as a reviewable list, then apply.
2. **Emphasis captions:** AI marks key words, and the caption renderer scales or recolors them.
3. **Silence and filler removal:** detect gaps with FFmpeg `silencedetect`, then output `trim` ops or split clips.
4. **Brand kits:** store fonts, colors, logo in `brand.json`. The AI is told to use it by default.
5. **Multi-aspect export:** same timeline rendered 16:9, 9:16, 1:1 with layout rules per component.
6. **Vision feedback loop:** render a frame with `renderStill()`, send it to Claude, and ask it to check overlap or readability, then auto-fix.
7. **Translation:** translate `captions.json` while preserving timings, as a second caption track.
8. **Templates:** save timelines as presets ("Product Demo", "Reel").

---

## 13. Milestones and Checklist

| # | Milestone | Done when |
|---|---|---|
| 1 | Project + Studio running | Blank comp previews |
| 2 | Schema + sample `timeline.json` | Zod parse passes |
| 3 | Ingest: transcribe | `whisper-words.json` exists |
| 4 | Ingest: script alignment | `captions.json` matches script text |
| 5 | Captions component | Word highlight in sync |
| 6 | Title, LowerThird, Callout | Appear at the right times |
| 7 | Render MP4 | Final file plays correctly |
| 8 | AI ops + CLI | Prompt changes the JSON, validated |
| 9 | Web editor | Prompt → live preview → export |
| 10 | Intelligence upgrades | Pick from §12 |

---

## 14. Testing

- **Schema tests:** valid and invalid timelines (Vitest).
- **`applyOps` unit tests:** every op, including error paths (missing id).
- **Align tests:** script with extra, missing, and misheard words. Confirm no timing goes backwards (`start[i] <= start[i+1]`).
- **Golden frames:** `renderStill()` at fixed frames and compare against saved PNGs for regressions.
- **AI eval set:** 30 to 50 prompts with expected ops. Run on every prompt or model change and track pass rate.

---

## 15. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Captions drift from audio | Wrong sample rate. Re-extract at 16 kHz mono. Or clip trimmed without source→timeline mapping |
| Whisper very slow | Use `small` model, or run on GPU / Apple Silicon |
| Wrong language transcribed | Using `.en` model. Switch to multilingual |
| Fonts differ in render | Load with `@remotion/google-fonts` and await load before render |
| Black frames in render | Use `<OffthreadVideo>`; check codec is H.264 and file path is under `public/` |
| AI returns invalid ops | Retry loop feeds the Zod error back. Tighten the system prompt with exact shapes |
| Render out of memory | Lower `--concurrency`, use proxies, split long edits |
| Zod/Remotion type errors | Align Zod version with what Remotion documents |

---

## 16. Licensing and Cost Notes

- Remotion: free for individuals and companies of up to 3 people. Larger for-profit teams need the company license. Confirm at remotion.pro before commercial rollout.
- Whisper.cpp, FFmpeg, React, Zod: free.
- Claude API: pay per token. Each edit sends the timeline and transcript, so keep them compact (trim transcript context to a window around the request for long videos).
- Local rendering has no per-render fee.

---

## 17. Suggested Next Step

Start with Milestones 1 to 7 (no AI). Once a hand-edited `timeline.json` renders a correct video, Milestone 8 is a small addition because the data layer already exists.

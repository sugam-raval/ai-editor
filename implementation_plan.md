# AI-Driven Video Editor: Implementation Plan

## 1. Overview
Building an end-to-end AI-driven video editor leveraging:
- **Remotion** (React + TypeScript) for motion graphics, composition, and rendering
- **whisper.cpp** via `@remotion/install-whisper-cpp` for speech-to-text with word-level timestamps
- **FFmpeg / ffprobe** for media probing and 16 kHz mono WAV audio extraction
- **Zod** for schema contracts and runtime validation across all boundaries
- **Anthropic Claude API** for tool-use based timeline mutations
- **Web Editor / Player** for live preview and interactive prompt-based edits

---

## 2. Architecture & File Structure
```
video-creation/
├── .env                       # ANTHROPIC_API_KEY, CLAUDE_MODEL
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── public/
│   └── footage/               # Source media assets
├── data/
│   ├── script.txt             # Target script
│   ├── whisper-words.json     # Raw whisper transcription
│   ├── captions.json          # Aligned captions with word timestamps
│   ├── timeline.json          # Single source of truth for edit
│   └── history/               # Snapshots for undo functionality
├── scripts/
│   ├── probe.ts               # ffprobe helper
│   ├── transcribe.ts          # Whisper transcription
│   ├── align.ts               # Needleman-Wunsch script-to-audio alignment
│   ├── ingest.ts              # End-to-end pipeline runner
│   └── render.ts              # Remotion render script
├── src/
│   ├── index.ts               # registerRoot entrypoint
│   ├── Root.tsx               # Remotion Root composition with dynamic metadata
│   ├── schema.ts              # Zod schemas for Timeline, Overlays, Captions, Clips
│   ├── time.ts                # Time and frame conversion utilities
│   ├── MainVideo.tsx          # Main composition rendering clips, overlays, captions
│   └── components/
│       ├── Captions.tsx       # Dynamic word-level highlight captions
│       ├── Title.tsx          # Animated title overlay
│       ├── LowerThird.tsx     # Animated lower third overlay
│       ├── Callout.tsx        # Highlight callout overlay
│       └── registry.ts        # Overlay type-to-component mapping
├── ai/
│   ├── ops.ts                 # Operation schemas & applyOps() state machine
│   ├── tools.ts               # Claude tool use definitions
│   ├── systemPrompt.md        # AI editing instructions and constraints
│   ├── edit.ts                # Claude API execution & retry loop
│   └── cli.ts                 # CLI tool for prompt-based edits
├── tests/
│   ├── schema.test.ts         # Schema validation tests
│   ├── ops.test.ts            # Timeline operations unit tests
│   └── align.test.ts          # Alignment algorithm unit tests
├── Doc/
│   └── 2026-10-29.md          # Daily activity log
└── implementation_plan.md
```

---

## 3. Implementation Phases

### Phase 1: Environment Setup & Core Schema
- Initialize project dependencies: `remotion`, `@remotion/captions`, `@remotion/transitions`, `@remotion/google-fonts`, `@remotion/install-whisper-cpp`, `zod`, `@anthropic-ai/sdk`, `fast-glob`, `dotenv`, `tsx`, `typescript`, `vitest`.
- Setup `remotion.config.ts`, `tsconfig.json`, `.gitignore`, and `.env.example`.
- Implement `src/schema.ts` with strict Zod contracts:
  - `ClipSchema`: id, src, duration, trimStart, trimEnd, volume
  - `OverlaySchema`: discriminated union for `title`, `lowerThird`, `callout`
  - `CaptionStyleSchema`: styling configuration for subtitles
  - `TimelineSchema`: versioned timeline state contract
  - `WordSchema` and `CaptionsSchema`: timestamped words
- Implement `src/time.ts` (sec <-> frames conversions).
- Create seed data in `data/timeline.json` and verify Zod validation.

### Phase 2: Ingest & Speech Alignment Pipeline
- Implement `scripts/transcribe.ts` leveraging `whisper.cpp` for token/word-level timestamps.
- Implement `scripts/align.ts` implementing the Needleman-Wunsch dynamic programming alignment algorithm between script text and heard audio.
- Implement `scripts/ingest.ts` coordinating ffprobe probing, ffmpeg audio conversion (16kHz mono), whisper transcription, script alignment, and timeline scaffolding.

### Phase 3: Remotion Compositions & Motion Graphics Components
- Implement `src/components/Captions.tsx`: chunking words into pages, current time active highlighting, custom styling.
- Implement animated motion graphic components using `spring()` and `interpolate()`:
  - `Title.tsx`
  - `LowerThird.tsx`
  - `Callout.tsx`
- Implement `src/components/registry.ts` mapping overlay types to components.
- Implement `src/MainVideo.tsx` laying clips end-to-end with `<OffthreadVideo>`, rendering overlays via registry, and embedding captions.
- Implement `src/Root.tsx` with dynamic `calculateMetadata` computing total frame duration and resolution.
- Implement `src/index.ts` calling `registerRoot(Root)`.

### Phase 4: Preview & Rendering
- Configure Remotion Studio scripts in `package.json`.
- Implement `scripts/render.ts` using Remotion CLI / renderer.

### Phase 5: AI Edit Layer
- Implement `ai/ops.ts`:
  - `OpSchema` discriminated union (`add_overlay`, `update_overlay`, `remove_overlay`, `set_caption_style`, `trim_clip`, `set_music`, `remove_music`).
  - `applyOps(timeline, ops)` with strict validation.
- Implement `ai/systemPrompt.md` with guidelines, transcript syntax, overlay defaults, and operation schemas.
- Implement `ai/tools.ts` and `ai/edit.ts` using Claude API tool use with validation retry loops.
- Implement `ai/cli.ts` CLI interface for natural language timeline updates and automatic history snapshotting.

### Phase 6: Automated Testing & Verification
- Unit test suite covering:
  - Schema validation (valid and invalid cases)
  - `applyOps` handling all operations and error handling
  - Needleman-Wunsch alignment handling matches, mismatches, gaps, and monotonic timestamps
- Verification of Remotion compositions and build.

---

## 4. Verification & Done Criteria
1. `npm test` runs all unit tests with 100% pass rate.
2. `timeline.json` validates strictly against `TimelineSchema`.
3. Studio / composition builds and runs cleanly.
4. AI editing ops correctly mutate timeline state with history snapshotting.

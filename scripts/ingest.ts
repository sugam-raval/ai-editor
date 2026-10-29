import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { probeMedia } from "./probe";
import { alignScript } from "./align";
import { runTranscription } from "./transcribe";
import { TimelineSchema, CaptionsSchema, type Timeline } from "../src/schema";

export interface IngestOptions {
  videoSrc?: string; // relative to public/, e.g. "footage/sample.mp4"
  scriptPath?: string;
  skipWhisper?: boolean; // useful for fast testing or offline mode
}

export async function runIngest(options: IngestOptions = {}) {
  const videoRelative = options.videoSrc || "footage/sample.mp4";
  const videoPath = path.join(process.cwd(), "public", videoRelative);
  const scriptPath = options.scriptPath || path.join(process.cwd(), "data", "script.txt");
  const audioOut = path.join(process.cwd(), "data", "audio.wav");
  const wordsOut = path.join(process.cwd(), "data", "whisper-words.json");
  const captionsOut = path.join(process.cwd(), "data", "captions.json");
  const timelineOut = path.join(process.cwd(), "data", "timeline.json");

  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Source video not found at ${videoPath}`);
  }

  // 1. Probe video
  console.log(`[Ingest] Probing video metadata from ${videoPath}...`);
  const meta = probeMedia(videoPath);
  console.log(`[Ingest] Metadata: ${meta.width}x${meta.height} @ ${meta.fps}fps, duration: ${meta.duration}s`);

  // 2. Extract 16kHz mono audio for Whisper
  console.log(`[Ingest] Extracting 16kHz mono audio to ${audioOut}...`);
  execSync(`ffmpeg -y -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioOut}"`, {
    stdio: "inherit",
  });

  // 3. Transcribe with Whisper
  let heardWords: any[] = [];
  if (options.skipWhisper && fs.existsSync(wordsOut)) {
    console.log(`[Ingest] Skipping Whisper execution, using existing ${wordsOut}`);
    heardWords = JSON.parse(fs.readFileSync(wordsOut, "utf8")).words;
  } else {
    try {
      console.log(`[Ingest] Running Whisper transcription...`);
      heardWords = await runTranscription({ audioPath: audioOut, outputPath: wordsOut });
    } catch (err) {
      console.warn(`[Ingest] Whisper transcription failed or skipped: ${(err as Error).message}`);
      if (fs.existsSync(wordsOut)) {
        heardWords = JSON.parse(fs.readFileSync(wordsOut, "utf8")).words;
      }
    }
  }

  // 4. Align with script if present
  let finalWords = heardWords;
  if (fs.existsSync(scriptPath)) {
    console.log(`[Ingest] Found script at ${scriptPath}, aligning with speech...`);
    const scriptText = fs.readFileSync(scriptPath, "utf8");
    finalWords = alignScript(scriptText, heardWords);
  } else {
    console.log(`[Ingest] No script.txt provided, using raw transcription.`);
  }

  const captionsData = CaptionsSchema.parse({ words: finalWords });
  fs.writeFileSync(captionsOut, JSON.stringify(captionsData, null, 2));
  console.log(`[Ingest] Wrote ${finalWords.length} words to ${captionsOut}`);

  // 5. Scaffold or update timeline.json
  let currentTimeline: Partial<Timeline> = {};
  if (fs.existsSync(timelineOut)) {
    try {
      currentTimeline = JSON.parse(fs.readFileSync(timelineOut, "utf8"));
    } catch {
      // ignore
    }
  }

  const timeline: Timeline = {
    version: 1,
    fps: meta.fps,
    width: meta.width,
    height: meta.height,
    clips: [
      {
        id: "c1",
        src: videoRelative,
        duration: meta.duration,
        trimStart: 0,
        trimEnd: meta.duration,
        volume: 1,
      },
    ],
    overlays: currentTimeline.overlays || [],
    captionStyle: currentTimeline.captionStyle || {
      enabled: true,
      position: "bottom",
      fontFamily: "Inter, sans-serif",
      fontSize: 56,
      color: "#ffffff",
      highlightColor: "#ffd400",
      background: "rgba(0,0,0,0.55)",
      maxWordsPerLine: 6,
      uppercase: false,
    },
    ...(currentTimeline.music ? { music: currentTimeline.music } : {}),
  };

  const validatedTimeline = TimelineSchema.parse(timeline);
  fs.writeFileSync(timelineOut, JSON.stringify(validatedTimeline, null, 2));
  console.log(`[Ingest] Successfully scaffolded timeline at ${timelineOut}`);
}

if (process.argv[1]?.endsWith("ingest.ts")) {
  runIngest().catch((err) => {
    console.error("Ingest failed:", err);
    process.exit(1);
  });
}

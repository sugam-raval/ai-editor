import path from "node:path";
import fs from "node:fs";
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

export interface TranscribeOptions {
  audioPath?: string;
  outputPath?: string;
  model?: "tiny" | "base" | "small" | "medium" | "medium.en" | "large-v3";
  whisperVersion?: string;
}

export async function runTranscription(options: TranscribeOptions = {}) {
  const audioPath = options.audioPath || "data/audio.wav";
  const outputPath = options.outputPath || "data/whisper-words.json";
  const model = options.model || "small";
  const whisperVersion = options.whisperVersion || "1.5.5";
  const whisperPath = path.join(process.cwd(), "whisper.cpp");

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at: ${audioPath}`);
  }

  console.log(`[Whisper] Ensuring whisper.cpp v${whisperVersion} is installed at ${whisperPath}...`);
  await installWhisperCpp({ to: whisperPath, version: whisperVersion });

  console.log(`[Whisper] Ensuring model ${model} is downloaded...`);
  await downloadWhisperModel({ model, folder: whisperPath });

  console.log(`[Whisper] Transcribing ${audioPath}...`);
  const out = await transcribe({
    inputPath: audioPath,
    whisperPath,
    whisperCppVersion: whisperVersion,
    model,
    tokenLevelTimestamps: true,
  });

  const { captions } = toCaptions({ whisperCppOutput: out });
  const words = captions
    .map((c) => ({
      text: c.text.trim(),
      start: Number((c.startMs / 1000).toFixed(3)),
      end: Number((c.endMs / 1000).toFixed(3)),
    }))
    .filter((w) => w.text.length > 0);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ words }, null, 2));
  console.log(`[Whisper] Extracted ${words.length} timed words to ${outputPath}`);
  return words;
}

if (process.argv[1]?.endsWith("transcribe.ts")) {
  runTranscription().catch((err) => {
    console.error("Transcription error:", err);
    process.exit(1);
  });
}

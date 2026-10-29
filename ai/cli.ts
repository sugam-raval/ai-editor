import fs from "node:fs";
import path from "node:path";
import { editTimeline } from "./edit";
import { TimelineSchema, CaptionsSchema, type Timeline } from "../src/schema";

export async function runCli() {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    console.error("Usage: npm run ai:edit -- \"<prompt>\"");
    console.error("Example: npm run ai:edit -- \"Make captions yellow and bigger\"");
    process.exit(1);
  }

  const timelinePath = path.join(process.cwd(), "data", "timeline.json");
  const captionsPath = path.join(process.cwd(), "data", "captions.json");
  const historyDir = path.join(process.cwd(), "data", "history");

  if (!fs.existsSync(timelinePath)) {
    console.error(`Timeline file not found: ${timelinePath}`);
    process.exit(1);
  }

  const rawTimeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
  const timeline: Timeline = TimelineSchema.parse(rawTimeline);

  let words: any[] = [];
  if (fs.existsSync(captionsPath)) {
    try {
      words = CaptionsSchema.parse(JSON.parse(fs.readFileSync(captionsPath, "utf8"))).words;
    } catch (e) {
      console.warn("Could not parse captions words:", e);
    }
  }

  console.log(`[AI CLI] Processing prompt: "${prompt}"...`);
  const result = await editTimeline(prompt, timeline, words);

  // Snapshot before saving
  fs.mkdirSync(historyDir, { recursive: true });
  const snapshotPath = path.join(historyDir, `${Date.now()}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(timeline, null, 2));
  console.log(`[AI CLI] Saved history snapshot to ${snapshotPath}`);

  // Write new timeline
  fs.writeFileSync(timelinePath, JSON.stringify(result.timeline, null, 2));
  console.log(`[AI CLI] Applied edits successfully!`);
  console.log(`Summary: ${result.summary}`);
  console.log(`Operations applied:`, JSON.stringify(result.ops, null, 2));
}

if (process.argv[1]?.endsWith("cli.ts")) {
  runCli().catch((err) => {
    console.error("[AI CLI Error]:", err.message || err);
    process.exit(1);
  });
}

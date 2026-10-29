import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

export interface RenderOptions {
  compositionId?: string;
  outputPath?: string;
  timelinePath?: string;
  concurrency?: number;
}

export function renderVideo(options: RenderOptions = {}) {
  const compId = options.compositionId || "MainVideo";
  const outPath = options.outputPath || path.join(process.cwd(), "out", "final.mp4");
  const timelinePath = options.timelinePath || path.join(process.cwd(), "data", "timeline.json");
  const captionsPath = path.join(process.cwd(), "data", "captions.json");
  const concurrency = options.concurrency || 2;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Merge timeline with captions words if available
  const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
  let words: any[] = [];
  if (fs.existsSync(captionsPath)) {
    try {
      words = JSON.parse(fs.readFileSync(captionsPath, "utf8")).words || [];
    } catch {
      // ignore
    }
  }

  const propsFile = path.join(process.cwd(), "data", ".render-props.json");
  fs.writeFileSync(propsFile, JSON.stringify({ ...timeline, words }, null, 2));

  console.log(`[Render] Rendering composition "${compId}" to ${outPath}...`);
  const cmd = `npx remotion render src/index.ts ${compId} "${outPath}" --props="${propsFile}" --concurrency=${concurrency} --codec=h264`;
  execSync(cmd, { stdio: "inherit" });

  if (fs.existsSync(propsFile)) {
    fs.unlinkSync(propsFile);
  }

  console.log(`[Render] Successfully rendered video to: ${outPath}`);
}

if (process.argv[1]?.endsWith("render.ts")) {
  renderVideo();
}

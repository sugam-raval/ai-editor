import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { editTimeline } from "../ai/edit";
import { renderVideo } from "../scripts/render";
import { TimelineSchema, CaptionsSchema, type Timeline } from "../src/schema";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  const timelinePath = path.join(process.cwd(), "data", "timeline.json");
  const captionsPath = path.join(process.cwd(), "data", "captions.json");
  const historyDir = path.join(process.cwd(), "data", "history");

  try {
    // 1. GET /api/timeline
    if (req.method === "GET" && pathname === "/api/timeline") {
      const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
      let captions = { words: [] };
      if (fs.existsSync(captionsPath)) {
        captions = JSON.parse(fs.readFileSync(captionsPath, "utf8"));
      }
      return sendJson(res, 200, { timeline, captions });
    }

    // 2. POST /api/edit
    if (req.method === "POST" && pathname === "/api/edit") {
      const body = await parseJsonBody(req);
      const prompt = body.prompt;
      if (!prompt) {
        return sendJson(res, 400, { error: "prompt is required" });
      }

      const timeline: Timeline = TimelineSchema.parse(
        JSON.parse(fs.readFileSync(timelinePath, "utf8"))
      );
      let words: any[] = [];
      if (fs.existsSync(captionsPath)) {
        words = CaptionsSchema.parse(
          JSON.parse(fs.readFileSync(captionsPath, "utf8"))
        ).words;
      }

      // Snapshot before change
      fs.mkdirSync(historyDir, { recursive: true });
      const snapshotPath = path.join(historyDir, `${Date.now()}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(timeline, null, 2));

      // Execute AI edit
      const result = await editTimeline(prompt, timeline, words);
      fs.writeFileSync(timelinePath, JSON.stringify(result.timeline, null, 2));

      return sendJson(res, 200, {
        success: true,
        timeline: result.timeline,
        summary: result.summary,
        ops: result.ops,
      });
    }

    // 3. POST /api/undo
    if (req.method === "POST" && pathname === "/api/undo") {
      if (!fs.existsSync(historyDir)) {
        return sendJson(res, 400, { error: "No history found" });
      }
      const files = fs
        .readdirSync(historyDir)
        .filter((f) => f.endsWith(".json"))
        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

      if (files.length === 0) {
        return sendJson(res, 400, { error: "No history snapshots available" });
      }

      const latestSnapshot = path.join(historyDir, files[0]);
      const restored = fs.readFileSync(latestSnapshot, "utf8");
      fs.writeFileSync(timelinePath, restored);
      fs.unlinkSync(latestSnapshot);

      return sendJson(res, 200, {
        success: true,
        timeline: JSON.parse(restored),
        message: "Restored previous snapshot",
      });
    }

    // 4. POST /api/render
    if (req.method === "POST" && pathname === "/api/render") {
      renderVideo();
      return sendJson(res, 200, {
        success: true,
        output: "/out/final.mp4",
      });
    }

    // 5. Serve static files (video previews, html dashboard)
    if (pathname.startsWith("/out/") || pathname.startsWith("/public/")) {
      const filePath = path.join(process.cwd(), pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".mp4": "video/mp4",
          ".wav": "audio/wav",
          ".mp3": "audio/mpeg",
          ".json": "application/json",
          ".jpg": "image/jpeg",
          ".png": "image/png",
        };
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // 6. Serve UI Dashboard
    if (pathname === "/" || pathname === "/index.html") {
      const htmlPath = path.join(process.cwd(), "editor", "index.html");
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return fs.createReadStream(htmlPath).pipe(res);
      }
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (err: any) {
    console.error("Server Error:", err);
    sendJson(res, 500, { error: err.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`[Web Editor] Running at http://localhost:${PORT}`);
});

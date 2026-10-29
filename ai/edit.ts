import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { OpSchema, applyOps, type Op } from "./ops";
import { editTools } from "./tools";
import { type Timeline, type Word } from "../src/schema";

export interface EditResult {
  timeline: Timeline;
  summary: string;
  ops: Op[];
}

export async function editTimeline(
  prompt: string,
  timeline: Timeline,
  words: Word[] = []
): Promise<EditResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY environment variable. Please set it in .env"
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219";

  const systemPath = path.join(process.cwd(), "ai", "systemPrompt.md");
  const system = fs.readFileSync(systemPath, "utf8");

  const context = {
    timeline,
    transcript: words.map((w) => `${w.text}@${w.start.toFixed(2)}`).join(" "),
  };

  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      model,
      max_tokens: 2000,
      system,
      tools: editTools,
      tool_choice: { type: "tool", name: "apply_edits" },
      messages: [
        {
          role: "user",
          content:
            `CURRENT STATE:\n${JSON.stringify(context, null, 2)}\n\nREQUEST: ${prompt}` +
            (lastError
              ? `\n\nYour previous attempt failed validation: ${lastError}\nPlease fix and try again.`
              : ""),
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use") as any;
    if (!block || !block.input) {
      lastError = "Model did not invoke apply_edits tool.";
      continue;
    }

    try {
      const ops = z.array(OpSchema).parse(block.input.ops);
      const next = applyOps(timeline, ops);
      return {
        timeline: next,
        summary: (block.input.summary as string) || "Timeline updated.",
        ops,
      };
    } catch (e: any) {
      lastError = String(e.message).slice(0, 800);
      console.warn(`[AI Attempt ${attempt + 1}/3 failed]: ${lastError}`);
    }
  }

  throw new Error("AI edit failed validation after 3 attempts: " + lastError);
}

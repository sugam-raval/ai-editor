import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const editTools: Tool[] = [
  {
    name: "apply_edits",
    description: "Apply one or more edit operations to the video timeline.",
    input_schema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          items: { type: "object" },
          description:
            "List of timeline edit operations (add_overlay, update_overlay, remove_overlay, set_caption_style, trim_clip, set_music, remove_music).",
        },
        summary: {
          type: "string",
          description: "One clear sentence describing what changed in the timeline.",
        },
      },
      required: ["ops", "summary"],
    },
  },
];

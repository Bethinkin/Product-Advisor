import { z } from "zod";
import { searchLimitless } from "../mcp/limitless-client";
import type { ToolDef } from "./types";

const schema = z.object({
  query: z.string().min(1),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchLimitlessTool: ToolDef<typeof schema> = {
  name: "search_limitless",
  description:
    "Search the user's Limitless lifelogs (wearable transcripts). Use when the question might be answered by something said in a meeting that wasn't uploaded as an artifact. Returns matching lifelog entries with snippets and timestamps.",
  schema,
  execute: async (args) => {
    const result = await searchLimitless(args);
    return result;
  },
};

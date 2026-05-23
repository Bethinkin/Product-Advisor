import { z } from "zod";
import { searchTranscripts } from "../../search/fts";
import type { ToolDef } from "./types";

const schema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(50).optional(),
  artifact_ids: z.array(z.string()).optional(),
  date_from: z.string().optional().describe("ISO date, inclusive"),
  date_to: z.string().optional().describe("ISO date, inclusive"),
});

export const searchTranscriptsTool: ToolDef<typeof schema> = {
  name: "search_transcripts",
  description:
    "Full-text search (BM25) over uploaded transcript chunks. Returns ranked snippets with artifact title, chunk id, speaker, and timestamp. Use before asking the user about anything that might be in a past meeting.",
  schema,
  execute: (args) => {
    const hits = searchTranscripts({
      query: args.query,
      k: args.k,
      artifactIds: args.artifact_ids,
      dateFromMs: args.date_from ? Date.parse(args.date_from) : undefined,
      dateToMs: args.date_to ? Date.parse(args.date_to) : undefined,
    });
    return { hits };
  },
};

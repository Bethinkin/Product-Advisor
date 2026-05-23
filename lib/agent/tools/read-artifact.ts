import { z } from "zod";
import fs from "node:fs/promises";
import { db } from "../../db/client";
import type { ToolDef } from "./types";

const schema = z.object({
  artifact_id: z.string(),
  start_char: z.number().int().min(0).optional(),
  end_char: z.number().int().min(0).optional(),
  max_chars: z.number().int().min(100).max(40000).optional(),
});

export const readArtifact: ToolDef<typeof schema> = {
  name: "read_artifact",
  description:
    "Read the full text (or a slice) of an artifact by id. For transcripts, reads from stored chunks (so timestamps are preserved). For CSV artifacts, returns a small preview — use query_data for analysis.",
  schema,
  execute: async (args) => {
    const a = db()
      .prepare("SELECT id, kind, title, storage_path FROM artifacts WHERE id = ?")
      .get(args.artifact_id) as
      | { id: string; kind: string; title: string; storage_path: string | null }
      | undefined;
    if (!a) throw new Error(`Artifact ${args.artifact_id} not found`);

    const maxChars = args.max_chars ?? 8000;

    if (a.kind === "transcript") {
      const chunks = db()
        .prepare(
          `SELECT chunk_index, start_char, end_char, start_timestamp_ms, end_timestamp_ms, speaker, text
           FROM transcript_chunks WHERE artifact_id = ? ORDER BY chunk_index`,
        )
        .all(a.id) as {
        chunk_index: number;
        start_char: number;
        end_char: number;
        start_timestamp_ms: number | null;
        end_timestamp_ms: number | null;
        speaker: string | null;
        text: string;
      }[];

      const startChar = args.start_char ?? 0;
      const endChar = args.end_char ?? Number.MAX_SAFE_INTEGER;
      const relevant = chunks.filter((c) => c.end_char >= startChar && c.start_char <= endChar);
      let total = 0;
      const out: typeof relevant = [];
      for (const c of relevant) {
        if (total + c.text.length > maxChars) break;
        out.push(c);
        total += c.text.length;
      }
      return {
        artifact_id: a.id,
        title: a.title,
        kind: a.kind,
        chunks: out,
        truncated: out.length < relevant.length,
        total_chunks: chunks.length,
      };
    }

    if (a.kind === "csv") {
      if (!a.storage_path) return { error: "CSV has no file backing" };
      const text = await fs.readFile(a.storage_path, "utf-8");
      return {
        artifact_id: a.id,
        title: a.title,
        kind: a.kind,
        preview: text.slice(0, maxChars),
        truncated: text.length > maxChars,
        total_chars: text.length,
        note: "Use query_data for analysis; this is just a preview.",
      };
    }

    // Generic file fallback
    if (a.storage_path) {
      const text = await fs.readFile(a.storage_path, "utf-8").catch(() => "");
      return {
        artifact_id: a.id,
        title: a.title,
        kind: a.kind,
        text: text.slice(args.start_char ?? 0, (args.start_char ?? 0) + maxChars),
        truncated: text.length > (args.start_char ?? 0) + maxChars,
        total_chars: text.length,
      };
    }

    return { artifact_id: a.id, title: a.title, kind: a.kind, text: "" };
  },
};

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

interface ArtifactRow {
  id: string;
  kind: string;
  title: string;
  storage_path: string | null;
  file_blob: Buffer | null;
}

async function loadBytes(a: ArtifactRow): Promise<Buffer | null> {
  if (a.file_blob) return a.file_blob;
  if (a.storage_path) {
    try {
      return await fs.readFile(a.storage_path);
    } catch {
      return null;
    }
  }
  return null;
}

export const readArtifact: ToolDef<typeof schema> = {
  name: "read_artifact",
  description:
    "Read the full text (or a slice) of an artifact by id. For transcripts, reads from stored chunks (so timestamps are preserved). For CSV artifacts, returns a small preview — use query_data for analysis.",
  schema,
  execute: async (args) => {
    const a = db()
      .prepare("SELECT id, kind, title, storage_path, file_blob FROM artifacts WHERE id = ?")
      .get(args.artifact_id) as ArtifactRow | undefined;
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

    const bytes = await loadBytes(a);
    if (!bytes) return { artifact_id: a.id, title: a.title, kind: a.kind, text: "" };
    const text = bytes.toString("utf-8");

    if (a.kind === "csv") {
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

    const offset = args.start_char ?? 0;
    return {
      artifact_id: a.id,
      title: a.title,
      kind: a.kind,
      text: text.slice(offset, offset + maxChars),
      truncated: text.length > offset + maxChars,
      total_chars: text.length,
    };
  },
};

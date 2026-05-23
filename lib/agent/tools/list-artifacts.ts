import { z } from "zod";
import { db } from "../../db/client";
import type { ToolDef } from "./types";

const schema = z.object({
  kind: z.enum(["transcript", "csv", "note", "recommendation", "notion_page"]).optional(),
});

export const listArtifacts: ToolDef<typeof schema> = {
  name: "list_artifacts",
  description:
    "Enumerate uploaded artifacts available to the assistant (transcripts, CSVs, notes, saved recommendations). Returns artifact ids, kinds, titles, and metadata. Always call this when starting a new conversation if context is thin.",
  schema,
  execute: (args) => {
    const where = args.kind ? "WHERE kind = ?" : "";
    const params = args.kind ? [args.kind] : [];
    const rows = db()
      .prepare(
        `SELECT id, kind, source, title, description, metadata_json, byte_size, created_at
         FROM artifacts ${where} ORDER BY created_at DESC LIMIT 100`,
      )
      .all(...params) as Record<string, unknown>[];
    return { artifacts: rows };
  },
};

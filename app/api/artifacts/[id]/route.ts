import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = db()
    .prepare(
      `SELECT id, kind, source, original_filename, mime_type, storage_path, byte_size,
              title, description, metadata_json, content_hash, created_at,
              (file_blob IS NOT NULL) as has_blob
         FROM artifacts WHERE id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!a) return new Response("Not found", { status: 404 });
  const result: Record<string, unknown> = {
    ...a,
    metadata: JSON.parse(String(a.metadata_json || "{}")),
  };

  if (a.kind === "transcript") {
    const chunks = db()
      .prepare(
        `SELECT chunk_index, start_char, end_char, start_timestamp_ms, end_timestamp_ms, speaker, text
         FROM transcript_chunks WHERE artifact_id = ? ORDER BY chunk_index`,
      )
      .all(id);
    result.chunks = chunks;
  } else if (a.kind === "csv") {
    const t = db().prepare(`SELECT * FROM csv_tables WHERE artifact_id = ?`).get(id) as
      | { table_name: string; columns_json: string; row_count: number }
      | undefined;
    if (t) {
      result.table = { name: t.table_name, columns: JSON.parse(t.columns_json), row_count: t.row_count };
    }
  }

  return Response.json(result);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = db().prepare(`SELECT storage_path FROM artifacts WHERE id = ?`).get(id) as
    | { storage_path: string | null }
    | undefined;
  // Best-effort cleanup of legacy on-disk file (pre-migration); blob is dropped with the row.
  if (a?.storage_path) await fs.unlink(a.storage_path).catch(() => undefined);
  const t = db().prepare(`SELECT table_name FROM csv_tables WHERE artifact_id = ?`).get(id) as
    | { table_name: string }
    | undefined;
  if (t) db().exec(`DROP TABLE IF EXISTS "${t.table_name}"`);
  db().prepare(`DELETE FROM artifacts WHERE id = ?`).run(id);
  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import path from "node:path";
import { db } from "@/lib/db/client";
import { ingestTranscript } from "@/lib/ingest/transcript";
import { ingestCsv } from "@/lib/ingest/csv";

export const runtime = "nodejs";
export const maxDuration = 120;

const TRANSCRIPT_EXTS = new Set([".txt", ".docx", ".pdf", ".vtt", ".md"]);

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT id, kind, source, original_filename, title, description, metadata_json, byte_size, created_at
       FROM artifacts ORDER BY created_at DESC LIMIT 500`,
    )
    .all();
  return Response.json({ artifacts: rows });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const title = (form.get("title") as string) || undefined;
    const description = (form.get("description") as string) || undefined;
    if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).toLowerCase();
    if (ext === ".csv") {
      const result = await ingestCsv({ filename: file.name, buffer, source: "upload", title, description });
      return Response.json(result);
    }
    if (TRANSCRIPT_EXTS.has(ext) || file.type.startsWith("text/")) {
      const result = await ingestTranscript({
        filename: file.name,
        mimeType: file.type,
        buffer,
        source: "upload",
        title,
        description,
      });
      return Response.json(result);
    }
    return Response.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
  }

  // JSON payload: pasted text
  const body = (await req.json()) as { text: string; title?: string; description?: string };
  if (!body.text || typeof body.text !== "string") {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }
  const result = await ingestTranscript({
    filename: `${body.title || "pasted"}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(body.text, "utf-8"),
    source: "paste",
    title: body.title,
    description: body.description,
  });
  return Response.json(result);
}

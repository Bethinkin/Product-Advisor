import path from "node:path";
import { nanoid } from "nanoid";
import mammoth from "mammoth";
import { WebVTTParser } from "webvtt-parser";
import { db } from "../db/client";
import { sha256 } from "../utils/hash";
import { chunkUtterances, type Utterance } from "./chunker";

export interface IngestResult {
  artifactId: string;
  chunkCount: number;
  needsOcr?: boolean;
  duplicate?: boolean;
}

export interface IngestInput {
  filename: string;
  mimeType?: string;
  buffer: Buffer;
  source: "upload" | "paste" | "limitless" | "notion";
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function ingestTranscript(input: IngestInput): Promise<IngestResult> {
  const hash = sha256(input.buffer);
  const existing = db()
    .prepare("SELECT id FROM artifacts WHERE content_hash = ?")
    .get(hash) as { id: string } | undefined;
  if (existing) {
    const count = db()
      .prepare("SELECT COUNT(*) as c FROM transcript_chunks WHERE artifact_id = ?")
      .get(existing.id) as { c: number };
    return { artifactId: existing.id, chunkCount: count.c, duplicate: true };
  }

  const ext = path.extname(input.filename).toLowerCase();
  const { utterances, needsOcr } = await parseByExt(ext, input.buffer);

  const artifactId = nanoid();
  const now = Date.now();
  const title = input.title || input.filename;

  db().prepare(
    `INSERT INTO artifacts (id, kind, source, original_filename, mime_type, file_blob, byte_size, title, description, metadata_json, content_hash, created_at)
     VALUES (?, 'transcript', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    artifactId,
    input.source,
    input.filename,
    input.mimeType || null,
    input.buffer,
    input.buffer.byteLength,
    title,
    input.description || "",
    JSON.stringify({ ...(input.metadata || {}), needsOcr: needsOcr || false }),
    hash,
    now,
  );

  const chunks = chunkUtterances(utterances);
  const insertChunk = db().prepare(
    `INSERT INTO transcript_chunks (id, artifact_id, chunk_index, start_char, end_char, start_timestamp_ms, end_timestamp_ms, speaker, text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFts = db().prepare(
    `INSERT INTO transcript_chunks_fts (chunk_id, text, speaker, title) VALUES (?, ?, ?, ?)`,
  );

  const tx = db().transaction(() => {
    for (const c of chunks) {
      const id = nanoid();
      insertChunk.run(
        id,
        artifactId,
        c.chunkIndex,
        c.startChar,
        c.endChar,
        c.startTimestampMs ?? null,
        c.endTimestampMs ?? null,
        c.speaker ?? null,
        c.text,
      );
      insertFts.run(id, c.text, c.speaker || "", title);
    }
  });
  tx();

  return { artifactId, chunkCount: chunks.length, needsOcr };
}

async function parseByExt(
  ext: string,
  buf: Buffer,
): Promise<{ utterances: Utterance[]; needsOcr?: boolean }> {
  if (ext === ".vtt") return { utterances: parseVtt(buf.toString("utf-8")) };
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { utterances: textToUtterances(result.value) };
  }
  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buf);
    const charsPerPage = result.text.length / Math.max(result.numpages, 1);
    const needsOcr = charsPerPage < 80;
    return { utterances: textToUtterances(result.text), needsOcr };
  }
  // .txt and unknown: treat as plain text
  return { utterances: textToUtterances(buf.toString("utf-8")) };
}

function parseVtt(content: string): Utterance[] {
  const parser = new WebVTTParser();
  const tree = parser.parse(content, "metadata");
  return tree.cues.map((cue: { text: string; startTime: number; endTime: number }) => {
    const text = cue.text.replace(/<[^>]+>/g, "").trim();
    const speakerMatch = /^([^:]{1,40}):\s*(.*)$/.exec(text);
    return {
      speaker: speakerMatch?.[1],
      text: speakerMatch?.[2] ?? text,
      startMs: Math.round(cue.startTime * 1000),
      endMs: Math.round(cue.endTime * 1000),
    };
  });
}

function textToUtterances(text: string): Utterance[] {
  // Split on blank lines; treat each paragraph as one utterance. If a line
  // starts with "Name:" pattern, extract speaker.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => {
    const m = /^([A-Z][\w .'-]{1,40}):\s*(.+)$/s.exec(p);
    if (m) return { speaker: m[1], text: m[2] };
    return { text: p };
  });
}

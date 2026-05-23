import { db } from "../db/client";

export interface TranscriptHit {
  artifact_id: string;
  artifact_title: string;
  chunk_id: string;
  chunk_index: number;
  score: number;
  snippet: string;
  speaker?: string;
  start_timestamp_ms?: number;
  end_timestamp_ms?: number;
}

export interface SearchOpts {
  query: string;
  k?: number;
  artifactIds?: string[];
  dateFromMs?: number;
  dateToMs?: number;
}

export function searchTranscripts(opts: SearchOpts): TranscriptHit[] {
  const k = opts.k ?? 8;
  const ftsQuery = sanitizeFtsQuery(opts.query);
  if (!ftsQuery) return [];

  const filters: string[] = [];
  const params: unknown[] = [ftsQuery];

  if (opts.artifactIds && opts.artifactIds.length) {
    filters.push(`a.id IN (${opts.artifactIds.map(() => "?").join(",")})`);
    params.push(...opts.artifactIds);
  }
  if (opts.dateFromMs) {
    filters.push("a.created_at >= ?");
    params.push(opts.dateFromMs);
  }
  if (opts.dateToMs) {
    filters.push("a.created_at <= ?");
    params.push(opts.dateToMs);
  }
  params.push(k);

  const where = filters.length ? "AND " + filters.join(" AND ") : "";

  const sql = `
    SELECT c.id as chunk_id, c.artifact_id, c.chunk_index, c.speaker,
           c.start_timestamp_ms, c.end_timestamp_ms,
           a.title as artifact_title,
           snippet(transcript_chunks_fts, 1, '<mark>', '</mark>', '…', 32) as snippet,
           bm25(transcript_chunks_fts) as score
    FROM transcript_chunks_fts
    JOIN transcript_chunks c ON c.id = transcript_chunks_fts.chunk_id
    JOIN artifacts a ON a.id = c.artifact_id
    WHERE transcript_chunks_fts MATCH ? ${where}
    ORDER BY score
    LIMIT ?
  `;

  return db().prepare(sql).all(...params) as TranscriptHit[];
}

// FTS5 has syntactic operators (AND OR NOT NEAR "*) — strip anything dodgy and
// quote-wrap multi-word queries so it parses as a phrase OR token list.
function sanitizeFtsQuery(q: string): string {
  const tokens = q
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

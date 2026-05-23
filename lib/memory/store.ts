import { nanoid } from "nanoid";
import { db } from "../db/client";

export interface MemoryDoc {
  id: string;
  slug: string;
  title: string;
  content: string;
  tags: string[];
  created_by: string;
  created_at: number;
  updated_at: number;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  content: string;
  tags_json: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function rowToDoc(r: Row): MemoryDoc {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    tags: safeTags(r.tags_json),
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function safeTags(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function slugify(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "memo";
  return base;
}

function uniqueSlug(preferred: string): string {
  let slug = preferred;
  let n = 1;
  while (db().prepare("SELECT 1 FROM memory_documents WHERE slug = ?").get(slug)) {
    n++;
    slug = `${preferred}-${n}`;
  }
  return slug;
}

export function listMemories(opts: { tag?: string } = {}): MemoryDoc[] {
  let sql = `SELECT * FROM memory_documents`;
  const params: unknown[] = [];
  if (opts.tag) {
    // Match exact tag inside the JSON array (defensive against substrings).
    sql += ` WHERE tags_json LIKE ?`;
    params.push(`%"${opts.tag}"%`);
  }
  sql += ` ORDER BY updated_at DESC`;
  return (db().prepare(sql).all(...params) as Row[]).map(rowToDoc);
}

export function getMemoryById(idOrSlug: string): MemoryDoc | null {
  const row = db()
    .prepare(`SELECT * FROM memory_documents WHERE id = ? OR slug = ?`)
    .get(idOrSlug, idOrSlug) as Row | undefined;
  return row ? rowToDoc(row) : null;
}

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  score: number;
}

export function searchMemories(query: string, k = 8): SearchHit[] {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return [];
  return db()
    .prepare(
      `SELECT m.id as id, m.slug as slug, m.title as title,
              snippet(memory_documents_fts, 2, '<mark>', '</mark>', '…', 32) as snippet,
              bm25(memory_documents_fts) as score
         FROM memory_documents_fts
         JOIN memory_documents m ON m.id = memory_documents_fts.doc_id
        WHERE memory_documents_fts MATCH ?
        ORDER BY score
        LIMIT ?`,
    )
    .all(ftsQuery, k) as SearchHit[];
}

function sanitizeFtsQuery(q: string): string {
  const tokens = q
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

export interface WriteInput {
  id?: string;
  slug?: string;
  title?: string;
  content?: string;
  tags?: string[];
  mode: "create" | "replace" | "append";
  changed_by: "user" | "agent";
  message_id?: string;
  rationale?: string;
}

export function writeMemory(input: WriteInput): MemoryDoc {
  const now = Date.now();
  const target = resolveTarget(input);

  if (!target) {
    if (input.mode !== "create") {
      throw new Error(
        `Cannot ${input.mode} — no memory document found for ${input.id ?? input.slug ?? input.title}`,
      );
    }
    if (!input.title || !input.title.trim()) {
      throw new Error("Title is required when creating a memory document");
    }
    const id = nanoid();
    const slug = uniqueSlug(input.slug?.trim() || slugify(input.title));
    const content = input.content ?? "";
    const tags = JSON.stringify(input.tags ?? []);
    db().prepare(
      `INSERT INTO memory_documents (id, slug, title, content, tags_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, slug, input.title.trim(), content, tags, input.changed_by, now, now);
    db().prepare(
      `INSERT INTO memory_documents_fts (doc_id, title, content, tags) VALUES (?, ?, ?, ?)`,
    ).run(id, input.title.trim(), content, (input.tags ?? []).join(" "));
    db().prepare(
      `INSERT INTO memory_revisions (id, document_id, prev_content, next_content, changed_by, message_id, rationale, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
    ).run(
      nanoid(),
      id,
      content,
      input.changed_by,
      input.message_id ?? null,
      input.rationale ?? null,
      now,
    );
    return getMemoryById(id)!;
  }

  const prev = target.content;
  const nextContent =
    input.mode === "append"
      ? prev
        ? `${prev}\n${input.content ?? ""}`
        : (input.content ?? "")
      : (input.content ?? "");
  const nextTitle = input.title?.trim() || target.title;
  const nextTags = input.tags ?? target.tags;

  db().prepare(
    `UPDATE memory_documents SET title = ?, content = ?, tags_json = ?, updated_at = ? WHERE id = ?`,
  ).run(nextTitle, nextContent, JSON.stringify(nextTags), now, target.id);

  db().prepare(`DELETE FROM memory_documents_fts WHERE doc_id = ?`).run(target.id);
  db().prepare(
    `INSERT INTO memory_documents_fts (doc_id, title, content, tags) VALUES (?, ?, ?, ?)`,
  ).run(target.id, nextTitle, nextContent, nextTags.join(" "));

  db().prepare(
    `INSERT INTO memory_revisions (id, document_id, prev_content, next_content, changed_by, message_id, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    target.id,
    prev,
    nextContent,
    input.changed_by,
    input.message_id ?? null,
    input.rationale ?? null,
    now,
  );
  return getMemoryById(target.id)!;
}

function resolveTarget(input: WriteInput): MemoryDoc | null {
  if (input.id) return getMemoryById(input.id);
  if (input.slug) return getMemoryById(input.slug);
  if (input.title && input.mode !== "create") {
    const slugCandidate = slugify(input.title);
    return getMemoryById(slugCandidate);
  }
  return null;
}

export function deleteMemory(
  idOrSlug: string,
  by: "user" | "agent",
  rationale?: string,
): { ok: true; id: string } {
  const target = getMemoryById(idOrSlug);
  if (!target) throw new Error(`Memory document ${idOrSlug} not found`);
  // Final revision row before cascade-delete erases history.
  db().prepare(
    `INSERT INTO memory_revisions (id, document_id, prev_content, next_content, changed_by, rationale, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
  ).run(nanoid(), target.id, target.content, by, rationale ?? "deleted", Date.now());
  db().prepare(`DELETE FROM memory_documents WHERE id = ?`).run(target.id);
  db().prepare(`DELETE FROM memory_documents_fts WHERE doc_id = ?`).run(target.id);
  return { ok: true, id: target.id };
}

export function listRevisions(documentId: string) {
  return db()
    .prepare(
      `SELECT id, prev_content, next_content, changed_by, message_id, rationale, created_at
         FROM memory_revisions WHERE document_id = ? ORDER BY created_at DESC LIMIT 100`,
    )
    .all(documentId);
}

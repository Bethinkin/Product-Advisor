import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import { db } from "../db/client";
import { sha256 } from "../utils/hash";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "./data/uploads";

export type ColumnType = "integer" | "real" | "text" | "iso_date";

export interface CsvIngestResult {
  artifactId: string;
  tableName: string;
  rowCount: number;
  columns: { original: string; sanitized: string; type: ColumnType }[];
  duplicate?: boolean;
}

export async function ingestCsv(input: {
  filename: string;
  buffer: Buffer;
  source: "upload" | "paste";
  title?: string;
  description?: string;
}): Promise<CsvIngestResult> {
  const hash = sha256(input.buffer);
  const existing = db()
    .prepare("SELECT a.id, c.table_name, c.row_count, c.columns_json FROM artifacts a JOIN csv_tables c ON c.artifact_id = a.id WHERE a.content_hash = ?")
    .get(hash) as
    | { id: string; table_name: string; row_count: number; columns_json: string }
    | undefined;
  if (existing) {
    return {
      artifactId: existing.id,
      tableName: existing.table_name,
      rowCount: existing.row_count,
      columns: JSON.parse(existing.columns_json),
      duplicate: true,
    };
  }

  const text = input.buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length > 0 && !parsed.data.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  if (rows.length === 0) throw new Error("CSV has no data rows");

  const originalCols = parsed.meta.fields || Object.keys(rows[0]);
  const sample = rows.slice(0, 200);
  const columns = originalCols.map((original) => {
    const sanitized = sanitize(original);
    const type = inferType(sample.map((r) => r[original]));
    return { original, sanitized, type };
  });
  dedupeSanitized(columns);

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const storageName = `${Date.now()}-${nanoid(8)}.csv`;
  const storagePath = path.join(UPLOADS_DIR, storageName);
  await fs.writeFile(storagePath, input.buffer);

  const artifactId = nanoid();
  const tableName = `csv_${artifactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const now = Date.now();
  const title = input.title || input.filename;

  const colDefs = columns.map((c) => `"${c.sanitized}" ${sqlType(c.type)}`).join(", ");
  const tx = db().transaction(() => {
    db().prepare(
      `INSERT INTO artifacts (id, kind, source, original_filename, mime_type, storage_path, byte_size, title, description, metadata_json, content_hash, created_at)
       VALUES (?, 'csv', ?, ?, 'text/csv', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      artifactId,
      input.source,
      input.filename,
      storagePath,
      input.buffer.byteLength,
      title,
      input.description || "",
      JSON.stringify({ row_count: rows.length }),
      hash,
      now,
    );

    db().exec(`CREATE TABLE "${tableName}" (${colDefs})`);

    const placeholders = columns.map(() => "?").join(", ");
    const insertSql = `INSERT INTO "${tableName}" (${columns
      .map((c) => `"${c.sanitized}"`)
      .join(", ")}) VALUES (${placeholders})`;
    const insert = db().prepare(insertSql);
    for (const row of rows) {
      const values = columns.map((c) => coerce(row[c.original], c.type));
      insert.run(...values);
    }

    db().prepare(
      `INSERT INTO csv_tables (id, artifact_id, table_name, columns_json, row_count) VALUES (?, ?, ?, ?, ?)`,
    ).run(nanoid(), artifactId, tableName, JSON.stringify(columns), rows.length);
  });
  tx();

  return { artifactId, tableName, rowCount: rows.length, columns };
}

function sanitize(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return cleaned || "col";
}

function dedupeSanitized(cols: { sanitized: string }[]) {
  const seen = new Map<string, number>();
  for (const c of cols) {
    const base = c.sanitized;
    const n = seen.get(base) ?? 0;
    if (n > 0) c.sanitized = `${base}_${n}`;
    seen.set(base, n + 1);
  }
}

function inferType(samples: (string | undefined)[]): ColumnType {
  let allInt = true;
  let allNum = true;
  let allDate = true;
  let nonEmpty = 0;
  for (const raw of samples) {
    if (raw === undefined || raw === null || raw === "") continue;
    nonEmpty++;
    if (!/^-?\d+$/.test(raw)) allInt = false;
    if (!/^-?\d+(\.\d+)?$/.test(raw)) allNum = false;
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(raw)) allDate = false;
  }
  if (nonEmpty === 0) return "text";
  if (allInt) return "integer";
  if (allNum) return "real";
  if (allDate) return "iso_date";
  return "text";
}

function sqlType(t: ColumnType): string {
  if (t === "integer") return "INTEGER";
  if (t === "real") return "REAL";
  return "TEXT";
}

function coerce(raw: string | undefined, t: ColumnType): string | number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (t === "integer") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (t === "real") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

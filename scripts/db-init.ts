import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db/client";

const schemaPath = path.join(process.cwd(), "lib/db/schema.sql");
const sql = fs.readFileSync(schemaPath, "utf-8");

const database = db();
database.exec(sql);

// Idempotent migrations using PRAGMA user_version.
function userVersion(): number {
  return (database.pragma("user_version", { simple: true }) as number) || 0;
}
function setUserVersion(v: number) {
  database.pragma(`user_version = ${v}`);
}

function columnExists(table: string, column: string): boolean {
  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

// Migration v1: file_blob on artifacts, backfilled from disk where possible.
if (userVersion() < 1) {
  if (!columnExists("artifacts", "file_blob")) {
    database.exec(`ALTER TABLE artifacts ADD COLUMN file_blob BLOB`);
  }
  const rows = database
    .prepare(
      `SELECT id, storage_path FROM artifacts WHERE file_blob IS NULL AND storage_path IS NOT NULL`,
    )
    .all() as { id: string; storage_path: string }[];
  let backfilled = 0;
  for (const r of rows) {
    try {
      const buf = fs.readFileSync(r.storage_path);
      database
        .prepare(`UPDATE artifacts SET file_blob = ? WHERE id = ?`)
        .run(buf, r.id);
      backfilled++;
    } catch {
      // File missing — leave file_blob null; row stays readable via existing metadata.
    }
  }
  if (backfilled > 0) console.log(`Migration v1: backfilled ${backfilled} file_blob(s) from disk`);
  setUserVersion(1);
}

console.log(
  `Initialized database at ${process.env.DATABASE_PATH || "./data/product-advisor.db"} (schema v${userVersion()})`,
);

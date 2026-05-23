import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH || "./data/product-advisor.db";

let writeDb: Database.Database | null = null;
let readDb: Database.Database | null = null;

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function db(): Database.Database {
  if (writeDb) return writeDb;
  ensureDir();
  writeDb = new Database(DB_PATH);
  writeDb.pragma("journal_mode = WAL");
  writeDb.pragma("foreign_keys = ON");
  return writeDb;
}

export function readOnlyDb(): Database.Database {
  if (readDb) return readDb;
  ensureDir();
  readDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  readDb.pragma("query_only = ON");
  return readDb;
}

export function closeAll() {
  writeDb?.close();
  readDb?.close();
  writeDb = null;
  readDb = null;
}

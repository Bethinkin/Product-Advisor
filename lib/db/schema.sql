-- Product-Advisor SQLite schema
-- Run via `npm run db:init`. Idempotent (uses IF NOT EXISTS).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_profile (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL DEFAULT '',
  one_liner           TEXT NOT NULL DEFAULT '',
  target_users        TEXT NOT NULL DEFAULT '',
  value_prop          TEXT NOT NULL DEFAULT '',
  north_star_metric   TEXT NOT NULL DEFAULT '',
  current_okrs        TEXT NOT NULL DEFAULT '',
  known_constraints   TEXT NOT NULL DEFAULT '',
  freeform_notes      TEXT NOT NULL DEFAULT '',
  updated_at          INTEGER NOT NULL
);

INSERT OR IGNORE INTO product_profile (id, updated_at) VALUES ('default', 0);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'New conversation',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id                       TEXT PRIMARY KEY,
  conversation_id          TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                     TEXT NOT NULL,
  content                  TEXT NOT NULL,
  model                    TEXT,
  input_tokens             INTEGER DEFAULT 0,
  output_tokens            INTEGER DEFAULT 0,
  cache_read_tokens        INTEGER DEFAULT 0,
  cache_creation_tokens    INTEGER DEFAULT 0,
  created_at               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id                  TEXT PRIMARY KEY,
  kind                TEXT NOT NULL,
  source              TEXT NOT NULL,
  original_filename   TEXT,
  mime_type           TEXT,
  storage_path        TEXT,
  byte_size           INTEGER DEFAULT 0,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  metadata_json       TEXT NOT NULL DEFAULT '{}',
  content_hash        TEXT,
  created_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON artifacts(kind, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(content_hash) WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id                  TEXT PRIMARY KEY,
  artifact_id         TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  chunk_index         INTEGER NOT NULL,
  start_char          INTEGER NOT NULL,
  end_char            INTEGER NOT NULL,
  start_timestamp_ms  INTEGER,
  end_timestamp_ms    INTEGER,
  speaker             TEXT,
  text                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_artifact ON transcript_chunks(artifact_id, chunk_index);

CREATE VIRTUAL TABLE IF NOT EXISTS transcript_chunks_fts USING fts5(
  chunk_id UNINDEXED, text, speaker, title,
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS csv_tables (
  id            TEXT PRIMARY KEY,
  artifact_id   TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  table_name    TEXT NOT NULL UNIQUE,
  columns_json  TEXT NOT NULL,
  row_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_revisions (
  id           TEXT PRIMARY KEY,
  field        TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   TEXT NOT NULL,
  message_id   TEXT,
  rationale    TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revisions_created ON profile_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS notion_cache (
  page_id      TEXT PRIMARY KEY,
  title        TEXT,
  markdown     TEXT NOT NULL,
  fetched_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  tool          TEXT NOT NULL,
  target        TEXT,
  content_hash  TEXT,
  payload_json  TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

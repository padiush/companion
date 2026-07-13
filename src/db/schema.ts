import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The offline capture store. `projects` and `forms` are the read-side cache
 * pulled from the API; `instances`, `answers` and `media` hold device-authored
 * captures until they sync (used by the capture flow). `sync_meta` keeps cursors
 * such as each project's bundle `form_version_cursor`.
 *
 * Timestamps are ISO-8601 strings; booleans are 0/1.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  updated_at   TEXT,
  cached_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forms (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   INTEGER NOT NULL,
  updated_at  TEXT,
  structure   TEXT NOT NULL,
  cached_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS instances (
  id                   TEXT PRIMARY KEY,
  form_id              INTEGER NOT NULL,
  project_id           INTEGER NOT NULL,
  captured_at          TEXT,
  location_lat         REAL,
  location_lng         REAL,
  location_accuracy_m  REAL,
  location_captured_at TEXT,
  form_version_cursor  TEXT,
  sync_status          TEXT NOT NULL DEFAULT 'draft',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  client_id        TEXT PRIMARY KEY,
  instance_id      TEXT NOT NULL,
  section_id       INTEGER NOT NULL,
  item_id          INTEGER NOT NULL,
  repeatable_index INTEGER,
  value            TEXT,
  edited_at        TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
  client_id            TEXT PRIMARY KEY,
  instance_id          TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  local_uri            TEXT,
  storage_key          TEXT,
  content_type         TEXT,
  byte_size            INTEGER,
  duration_s           INTEGER,
  upload_status        TEXT NOT NULL DEFAULT 'pending',
  transcription_status TEXT,
  captured_at          TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forms_project ON forms(project_id);
CREATE INDEX IF NOT EXISTS idx_answers_instance ON answers(instance_id);
CREATE INDEX IF NOT EXISTS idx_media_instance ON media(instance_id);
CREATE INDEX IF NOT EXISTS idx_instances_sync_status ON instances(sync_status);
`;

/** Create the schema if it doesn't exist. Safe to run on every launch. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA);
}

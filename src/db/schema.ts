import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The offline capture store. `projects` and `forms` are the read-side cache
 * pulled from the API; `instances`, `answers` and `media` hold device-authored
 * captures until they sync (used by the capture flow). `media_blobs` holds the
 * media bytes themselves, chunked, so they sit inside the encrypted store
 * rather than as plaintext files. `sync_meta` keeps cursors such as each
 * project's bundle `form_version_cursor`.
 *
 * Timestamps are ISO-8601 strings; booleans are 0/1.
 */
const V1 = `
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

CREATE TABLE IF NOT EXISTS media_blobs (
  client_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  data      BLOB NOT NULL,
  PRIMARY KEY (client_id, seq),
  FOREIGN KEY (client_id) REFERENCES media(client_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forms_project ON forms(project_id);
CREATE INDEX IF NOT EXISTS idx_answers_instance ON answers(instance_id);
CREATE INDEX IF NOT EXISTS idx_media_instance ON media(instance_id);
CREATE INDEX IF NOT EXISTS idx_instances_sync_status ON instances(sync_status);
`;

/**
 * Schema versions, applied in order and stamped into `PRAGMA user_version`.
 *
 * Version 1 is the schema as it shipped before this runner existed, so it is
 * written entirely with `IF NOT EXISTS`: stores created by the old
 * unconditional `migrate()` report `user_version = 0` even though they already
 * hold these tables, and replaying v1 over them has to be a no-op. Later
 * versions run exactly once and may use plain `ALTER TABLE`.
 *
 * Each version is applied inside a transaction together with its version
 * stamp, so an interrupted upgrade rolls back rather than leaving the store
 * half-migrated at a version that claims otherwise.
 */
/**
 * Why a push did not fully land, kept so it can be shown and acted on rather
 * than discarded. `instances.sync_error` explains a wholly rejected interview;
 * `answers.sync_error` marks the individual answers the server refused while
 * accepting the rest.
 */
const V2 = `
ALTER TABLE instances ADD COLUMN sync_error TEXT;
ALTER TABLE answers ADD COLUMN sync_error TEXT;
`;

export /**
 * Why a media upload has not landed. Every failure used to be swallowed by the
 * engine's catch, so an upload that failed every time was indistinguishable
 * from one that had simply not been tried — informant audio could sit on a
 * device indefinitely with nothing to show for it.
 */
const V3 = `
ALTER TABLE media ADD COLUMN upload_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN upload_error TEXT;
`;

export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: V1 },
  { version: 2, sql: V2 },
  { version: 3, sql: V3 },
];

/** The version a fully-migrated store reports. */
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

async function currentVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

/**
 * Bring the store up to `SCHEMA_VERSION`. Safe to run on every launch: already
 * applied versions are skipped.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const from = await currentVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) {
      continue;
    }

    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      // PRAGMA user_version takes a literal, not a bound parameter — the value
      // is our own integer constant, never user input.
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}

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

/**
 * Integrity events waiting to be reported. A few failures on this device
 * destroy unsynced captures or leave an unencrypted recording behind, and they
 * used to go to a console nobody reads — a researcher could lose a day's
 * interviews and never learn it happened.
 *
 * Codes, never messages. There is no column to put a file path or an answer in,
 * which is what lets these leave the device at all; the server rejects codes it
 * does not know. Rows are deleted once the server acknowledges them.
 */
const V4 = `
CREATE TABLE IF NOT EXISTS diagnostics (
  client_id   TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  app_version TEXT,
  platform    TEXT,
  os_version  TEXT
);
`;

/**
 * Field records, the permits they name, and media that belongs to one.
 *
 * A record is captured where it happens — coordinates from this device, the
 * collection number written on the tag at that moment
 * (docs/decisions/0011-companion-field-records.md in the platform repo). The
 * device authors the *recorded* stage only: there is deliberately no column for
 * an accession number, a repository or a determination, because those are
 * written on the web and a column here would invite the app to claim them.
 *
 * `server_id` is learned from the sync result. Unlike an interview, whose id
 * this device mints, a record has no server identity until the push answers
 * with one — and that id is what its media is later uploaded against.
 *
 * `collecting_permits` is a read-side cache like `projects` and `forms`. A
 * permit is held before the fieldwork; nobody issues one in a forest, so the
 * device only ever chooses among them.
 *
 * The rest of this version widens `media` to belong to an interview OR a field
 * record, mirroring what the server did in its own `media` migration. For a
 * record of something never collected the photograph *is* the record, since no
 * material survives to re-examine.
 *
 * The rebuild is written the long way round on purpose. `instance_id` is
 * NOT NULL and SQLite cannot relax that in place, so the table has to be
 * recreated — but `media_blobs` cascades off `media`, and dropping `media`
 * while it still has children silently deletes every blob, which is the
 * unsynced informant audio. `PRAGMA foreign_keys = OFF` is the usual guard and
 * is a no-op inside a transaction, which is where the runner puts every
 * version. So the children are moved aside to a foreign-key-free table first,
 * `media` is dropped only once it is childless, and the blobs are restored
 * afterwards. Verified to preserve blob bytes exactly, and to leave both
 * cascades working.
 */
const V5 = `
CREATE TABLE IF NOT EXISTS field_records (
  client_id            TEXT PRIMARY KEY,
  project_id           INTEGER NOT NULL,
  server_id            INTEGER,
  basis_of_record      TEXT NOT NULL DEFAULT 'preserved_specimen',
  vernacular_name      TEXT,
  collection_number    TEXT,
  collector            TEXT,
  collected_on         TEXT,
  locality             TEXT,
  location_lat         REAL,
  location_lng         REAL,
  notes                TEXT,
  collecting_permit_id INTEGER,
  permit_exemption     TEXT,
  answer_client_id     TEXT,
  edited_at            TEXT,
  sync_status          TEXT NOT NULL DEFAULT 'draft',
  sync_error           TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collecting_permits (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  authority  TEXT,
  reference  TEXT,
  issued_on  TEXT,
  expires_on TEXT,
  cached_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_records_project ON field_records(project_id);
CREATE INDEX IF NOT EXISTS idx_field_records_sync_status ON field_records(sync_status);
CREATE INDEX IF NOT EXISTS idx_collecting_permits_project ON collecting_permits(project_id);

CREATE TABLE media_blobs_tmp (
  client_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  data      BLOB NOT NULL,
  PRIMARY KEY (client_id, seq)
);
INSERT INTO media_blobs_tmp (client_id, seq, data)
  SELECT client_id, seq, data FROM media_blobs;
DROP TABLE media_blobs;

CREATE TABLE media_new (
  client_id            TEXT PRIMARY KEY,
  instance_id          TEXT,
  field_record_id      TEXT,
  kind                 TEXT NOT NULL,
  local_uri            TEXT,
  storage_key          TEXT,
  content_type         TEXT,
  byte_size            INTEGER,
  duration_s           INTEGER,
  upload_status        TEXT NOT NULL DEFAULT 'pending',
  upload_attempts      INTEGER NOT NULL DEFAULT 0,
  upload_error         TEXT,
  transcription_status TEXT,
  captured_at          TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (field_record_id) REFERENCES field_records(client_id) ON DELETE CASCADE
);
INSERT INTO media_new (
  client_id, instance_id, field_record_id, kind, local_uri, storage_key,
  content_type, byte_size, duration_s, upload_status, upload_attempts,
  upload_error, transcription_status, captured_at
) SELECT
  client_id, instance_id, NULL, kind, local_uri, storage_key,
  content_type, byte_size, duration_s, upload_status, upload_attempts,
  upload_error, transcription_status, captured_at
FROM media;
DROP TABLE media;
ALTER TABLE media_new RENAME TO media;

CREATE TABLE media_blobs (
  client_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  data      BLOB NOT NULL,
  PRIMARY KEY (client_id, seq),
  FOREIGN KEY (client_id) REFERENCES media(client_id) ON DELETE CASCADE
);
INSERT INTO media_blobs (client_id, seq, data)
  SELECT client_id, seq, data FROM media_blobs_tmp;
DROP TABLE media_blobs_tmp;

CREATE INDEX IF NOT EXISTS idx_media_instance ON media(instance_id);
CREATE INDEX IF NOT EXISTS idx_media_field_record ON media(field_record_id);
`;

/**
 * A small preview of each photograph, so a list of records can show what was
 * recorded rather than a name alone. Made at capture, while the camera's file
 * still exists, and kept encrypted here like the photo itself. It lives as
 * long as the photo's bytes do: when the photo is sent and deleted from the
 * device, so is its preview.
 */
const V6 = `
ALTER TABLE media ADD COLUMN thumbnail BLOB;
`;

export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: V1 },
  { version: 2, sql: V2 },
  { version: 3, sql: V3 },
  { version: 4, sql: V4 },
  { version: 5, sql: V5 },
  { version: 6, sql: V6 },
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

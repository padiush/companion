import type { SQLiteDatabase } from 'expo-sqlite';

import type { MediaRow } from './types';

/** Media the uploader can actually address: an interview owns it. */
export type InterviewMediaRow = MediaRow & { instance_id: string };

export interface MediaInsert {
  clientId: string;
  /** The owning interview, when an interview owns it. */
  instanceId?: string | null;
  /** The owning field record's client_id, when a record owns it. */
  fieldRecordId?: string | null;
  kind: 'audio' | 'photo';
  contentType: string;
  byteSize: number;
  durationS?: number | null;
  capturedAt: string;
}

/**
 * The media row holds metadata only; the bytes go into `media_blobs` chunks
 * (see the chunk functions below). `local_uri` stays NULL — media never lives
 * as a plaintext file once ingested.
 *
 * Exactly one owner: an interview or a field record, never both and never
 * neither. Enforced here rather than by the schema, because the two supported
 * shapes differ and a CHECK constraint would have to be written twice.
 */
export async function insertMedia(db: SQLiteDatabase, media: MediaInsert): Promise<void> {
  const instanceId = media.instanceId ?? null;
  const fieldRecordId = media.fieldRecordId ?? null;

  if ((instanceId === null) === (fieldRecordId === null)) {
    throw new Error('media must belong to exactly one of an interview or a field record');
  }

  await db.runAsync(
    `INSERT INTO media (
       client_id, instance_id, field_record_id, kind, local_uri, storage_key,
       content_type, byte_size, duration_s, upload_status, transcription_status, captured_at
     ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'pending', NULL, ?)`,
    [
      media.clientId,
      instanceId,
      fieldRecordId,
      media.kind,
      media.contentType,
      media.byteSize,
      media.durationS ?? null,
      media.capturedAt,
    ]
  );
}

export async function insertMediaChunk(
  db: SQLiteDatabase,
  clientId: string,
  seq: number,
  data: Uint8Array
): Promise<void> {
  await db.runAsync('INSERT INTO media_blobs (client_id, seq, data) VALUES (?, ?, ?)', [
    clientId,
    seq,
    data,
  ]);
}

/** The media bytes, reassembled from their chunks. Null when none are stored. */
export async function readMediaBytes(
  db: SQLiteDatabase,
  clientId: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  const rows = await db.getAllAsync<{ data: Uint8Array }>(
    'SELECT data FROM media_blobs WHERE client_id = ? ORDER BY seq',
    [clientId]
  );

  if (rows.length === 0) {
    return null;
  }

  const total = rows.reduce((sum, row) => sum + row.data.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const row of rows) {
    bytes.set(row.data, offset);
    offset += row.data.byteLength;
  }
  return bytes;
}

export async function deleteMediaBytes(db: SQLiteDatabase, clientId: string): Promise<void> {
  await db.runAsync('DELETE FROM media_blobs WHERE client_id = ?', [clientId]);
}

export async function listMediaForInstance(
  db: SQLiteDatabase,
  instanceId: string
): Promise<MediaRow[]> {
  return db.getAllAsync<MediaRow>(
    'SELECT * FROM media WHERE instance_id = ? ORDER BY captured_at',
    [instanceId]
  );
}

/**
 * Media awaiting upload whose interview has already synced — the server needs
 * the instance to exist before a media intent can be registered against it.
 *
 * Interview media only, and the `instance_id IS NOT NULL` is deliberate rather
 * than implied by the join: media on a field record has no upload path yet.
 * `records:sync` pushes the record, but there is no
 * `records/{record}/media/intent` for its photographs, so returning them here
 * would hand the uploader a null instance to address. The narrowed return type
 * is what keeps that a compile error rather than a crash in the field.
 */
export async function listPendingMedia(db: SQLiteDatabase): Promise<InterviewMediaRow[]> {
  return db.getAllAsync<InterviewMediaRow>(
    `SELECT m.* FROM media m
     JOIN instances i ON i.id = m.instance_id
     WHERE m.upload_status = 'pending'
       AND m.instance_id IS NOT NULL
       AND i.sync_status = 'synced'`
  );
}

/**
 * Media the server does not have yet, whether or not its interview has synced.
 *
 * Deliberately broader than `listPendingMedia`: this drives the outbox, and a
 * photo attached to a draft becomes uploadable the moment that draft is pushed,
 * in the same send. Counting only the immediately-uploadable ones would hide
 * the Send action in exactly the case where it is needed.
 */
export async function countPendingMedia(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    // Interview media only, for the same reason listPendingMedia is: a field
    // record's photographs cannot be uploaded yet, and counting them would put
    // a number on the Send action that no amount of sending clears.
    "SELECT COUNT(*) AS count FROM media WHERE upload_status != 'uploaded' AND instance_id IS NOT NULL"
  );

  return row?.count ?? 0;
}

export async function setMediaUploaded(
  db: SQLiteDatabase,
  clientId: string,
  storageKey: string
): Promise<void> {
  await db.runAsync(
    `UPDATE media
        SET upload_status = 'uploaded', storage_key = ?, upload_error = NULL
      WHERE client_id = ?`,
    [storageKey, clientId]
  );
}

/**
 * Note that an upload attempt failed, and why.
 *
 * Failures were previously swallowed whole, leaving no way to tell an upload
 * that fails every time from one that has never been tried. The item stays
 * pending — it should keep being retried — but the attempt count and the last
 * reason make a stuck one visible instead of silent.
 */
export async function recordUploadFailure(
  db: SQLiteDatabase,
  clientId: string,
  error: string
): Promise<void> {
  await db.runAsync(
    `UPDATE media
        SET upload_attempts = upload_attempts + 1, upload_error = ?
      WHERE client_id = ?`,
    [error, clientId]
  );
}

/** Media that has been tried and is still failing, for reporting. */
export async function countFailedMedia(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM media
      WHERE upload_status != 'uploaded' AND upload_error IS NOT NULL AND instance_id IS NOT NULL`
  );

  return row?.count ?? 0;
}

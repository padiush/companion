import type { SQLiteDatabase } from 'expo-sqlite';

import type { MediaRow } from './types';

/**
 * Media the uploader can address now. An interview's media goes up against the
 * interview's id, which the device minted; a field record's against the
 * record's server id, which it only learns once the record has synced — so
 * that id comes along with the row.
 */
export type UploadableMediaRow = MediaRow & { record_server_id: number | null };

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

/**
 * How many bytes are stored for the media, counted without reading them. Zero
 * when none are.
 */
export async function mediaByteSize(db: SQLiteDatabase, clientId: string): Promise<number> {
  const row = await db.getFirstAsync<{ size: number | null }>(
    'SELECT SUM(length(data)) AS size FROM media_blobs WHERE client_id = ?',
    [clientId]
  );

  return row?.size ?? 0;
}

/**
 * `length` bytes of the media starting at `offset`, read from only the chunks
 * that hold them — one part of a resumable upload, without reassembling the
 * whole file. Shorter than asked when the range runs past the end.
 */
export async function readMediaRange(
  db: SQLiteDatabase,
  clientId: string,
  offset: number,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  // Chunk sizes first, so only the chunks inside the range are read.
  const chunks = await db.getAllAsync<{ seq: number; size: number }>(
    'SELECT seq, length(data) AS size FROM media_blobs WHERE client_id = ? ORDER BY seq',
    [clientId]
  );

  const end = offset + length;
  const wanted: { seq: number; start: number }[] = [];
  let start = 0;
  for (const chunk of chunks) {
    if (start + chunk.size > offset && start < end) {
      wanted.push({ seq: chunk.seq, start });
    }
    start += chunk.size;
  }

  const bytes = new Uint8Array(Math.max(0, Math.min(end, start) - offset));

  for (const { seq, start: chunkStart } of wanted) {
    const row = await db.getFirstAsync<{ data: Uint8Array }>(
      'SELECT data FROM media_blobs WHERE client_id = ? AND seq = ?',
      [clientId, seq]
    );
    if (!row) {
      throw new Error('media bytes changed while being read');
    }

    const from = Math.max(offset - chunkStart, 0);
    const to = Math.min(end - chunkStart, row.data.byteLength);
    bytes.set(row.data.subarray(from, to), chunkStart + from - offset);
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

export async function listMediaForFieldRecord(
  db: SQLiteDatabase,
  fieldRecordId: string
): Promise<MediaRow[]> {
  return db.getAllAsync<MediaRow>(
    'SELECT * FROM media WHERE field_record_id = ? ORDER BY captured_at',
    [fieldRecordId]
  );
}

/**
 * Media awaiting upload whose owner the server already knows. The server needs
 * the owner to exist before a media intent can be registered against it: an
 * interview once it has synced, a field record once it has a server id — the
 * id the upload is addressed by. A record edited after it synced is back in
 * the outbox but keeps that id, so its photographs need not wait for it.
 */
export async function listPendingMedia(db: SQLiteDatabase): Promise<UploadableMediaRow[]> {
  return db.getAllAsync<UploadableMediaRow>(
    `SELECT m.*, NULL AS record_server_id FROM media m
       JOIN instances i ON i.id = m.instance_id
      WHERE m.upload_status = 'pending' AND i.sync_status = 'synced'
     UNION ALL
     SELECT m.*, r.server_id AS record_server_id FROM media m
       JOIN field_records r ON r.client_id = m.field_record_id
      WHERE m.upload_status = 'pending' AND r.server_id IS NOT NULL
     ORDER BY captured_at`
  );
}

/**
 * Media the server does not have yet, whether or not its owner has synced.
 *
 * Deliberately broader than `listPendingMedia`: this drives the outbox, and a
 * photo attached to a draft — interview or field record — becomes uploadable
 * the moment that draft is pushed, in the same send. Counting only the
 * immediately-uploadable ones would hide the Send action in exactly the case
 * where it is needed.
 */
export async function countPendingMedia(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM media WHERE upload_status != 'uploaded'"
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
      WHERE upload_status != 'uploaded' AND upload_error IS NOT NULL`
  );

  return row?.count ?? 0;
}

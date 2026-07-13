import type { SQLiteDatabase } from 'expo-sqlite';

import type { MediaRow } from './types';

export interface MediaInsert {
  clientId: string;
  instanceId: string;
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
 */
export async function insertMedia(db: SQLiteDatabase, media: MediaInsert): Promise<void> {
  await db.runAsync(
    `INSERT INTO media (
       client_id, instance_id, kind, local_uri, storage_key,
       content_type, byte_size, duration_s, upload_status, transcription_status, captured_at
     ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, 'pending', NULL, ?)`,
    [
      media.clientId,
      media.instanceId,
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
 */
export async function listPendingMedia(db: SQLiteDatabase): Promise<MediaRow[]> {
  return db.getAllAsync<MediaRow>(
    `SELECT m.* FROM media m
     JOIN instances i ON i.id = m.instance_id
     WHERE m.upload_status = 'pending' AND i.sync_status = 'synced'`
  );
}

export async function setMediaUploaded(
  db: SQLiteDatabase,
  clientId: string,
  storageKey: string
): Promise<void> {
  await db.runAsync(
    "UPDATE media SET upload_status = 'uploaded', storage_key = ? WHERE client_id = ?",
    [storageKey, clientId]
  );
}

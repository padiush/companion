import type { SQLiteDatabase } from 'expo-sqlite';

import type { MediaRow } from './types';

export interface MediaInsert {
  clientId: string;
  instanceId: string;
  kind: 'audio' | 'photo';
  localUri: string;
  contentType: string;
  byteSize: number;
  durationS?: number | null;
  capturedAt: string;
}

export async function insertMedia(db: SQLiteDatabase, media: MediaInsert): Promise<void> {
  await db.runAsync(
    `INSERT INTO media (
       client_id, instance_id, kind, local_uri, storage_key,
       content_type, byte_size, duration_s, upload_status, transcription_status, captured_at
     ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'pending', NULL, ?)`,
    [
      media.clientId,
      media.instanceId,
      media.kind,
      media.localUri,
      media.contentType,
      media.byteSize,
      media.durationS ?? null,
      media.capturedAt,
    ]
  );
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

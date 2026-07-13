import type { SQLiteDatabase } from 'expo-sqlite';

import { insertMedia } from '../db/mediaRepository';
import { uuid } from '../ids';

export interface AttachMediaParams {
  instanceId: string;
  kind: 'audio' | 'photo';
  localUri: string;
  contentType: string;
  byteSize: number;
  durationS?: number | null;
}

/**
 * Record a captured file (audio or photo) against a draft interview. The bytes
 * stay on the device; this persists the metadata and mints the client_id the
 * upload flow keys on. Returns the client_id.
 */
export async function attachMedia(db: SQLiteDatabase, params: AttachMediaParams): Promise<string> {
  const clientId = uuid();

  await insertMedia(db, {
    clientId,
    instanceId: params.instanceId,
    kind: params.kind,
    localUri: params.localUri,
    contentType: params.contentType,
    byteSize: params.byteSize,
    durationS: params.durationS ?? null,
    capturedAt: new Date().toISOString(),
  });

  return clientId;
}

import { File, FileMode } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertMedia, insertMediaChunk } from '../db/mediaRepository';
import { uuid } from '../ids';

/** Blob rows are capped so a long recording never has to sit in memory whole. */
const CHUNK_BYTES = 4 * 1024 * 1024;

export interface AttachMediaParams {
  instanceId: string;
  kind: 'audio' | 'photo';
  localUri: string;
  contentType: string;
  durationS?: number | null;
}

/**
 * Ingest a captured file (audio or photo) into the encrypted store and delete
 * the plaintext original. The capture APIs spool onto the cache directory, and
 * informant media must not stay on disk unencrypted — so the bytes are streamed
 * chunk by chunk into `media_blobs` in one transaction, keyed by the minted
 * client_id the upload flow uses. The source file is only deleted once the
 * ingest has committed; on failure it is left in place. Returns the client_id.
 */
export async function attachMedia(db: SQLiteDatabase, params: AttachMediaParams): Promise<string> {
  const clientId = uuid();
  const source = new File(params.localUri);
  const byteSize = source.size ?? 0;
  const handle = source.open(FileMode.ReadOnly);

  try {
    await db.withTransactionAsync(async () => {
      await insertMedia(db, {
        clientId,
        instanceId: params.instanceId,
        kind: params.kind,
        contentType: params.contentType,
        byteSize,
        durationS: params.durationS ?? null,
        capturedAt: new Date().toISOString(),
      });

      let seq = 0;
      let ingested = 0;
      for (;;) {
        const chunk = handle.readBytes(CHUNK_BYTES);
        if (chunk.byteLength === 0) {
          break;
        }
        await insertMediaChunk(db, clientId, seq, chunk);
        seq += 1;
        ingested += chunk.byteLength;
        if (chunk.byteLength < CHUNK_BYTES) {
          break;
        }
      }

      if (ingested !== byteSize) {
        throw new Error(`media ingest read ${ingested} bytes, expected ${byteSize}`);
      }
    });
  } finally {
    handle.close();
  }

  try {
    source.delete();
  } catch {
    console.warn('[media] could not delete the plaintext capture file', params.localUri);
  }

  return clientId;
}

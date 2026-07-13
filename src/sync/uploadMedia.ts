import { fetch } from 'expo/fetch';
import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { MediaKind } from '../api/types';
import {
  deleteMediaBytes,
  listPendingMedia,
  readMediaBytes,
  setMediaUploaded,
} from '../db/mediaRepository';

export interface MediaUploadSummary {
  uploaded: number;
  failed: number;
}

/** PUTs media bytes to a presigned URL. Injectable so the engine is testable. */
export type BytesUploader = (
  url: string,
  data: Uint8Array<ArrayBuffer>,
  headers: Record<string, string>
) => Promise<void>;

const uploadViaFetch: BytesUploader = async (url, data, headers) => {
  // expo/fetch normalizes typed-array bodies natively (ArrayBuffer.isView in
  // its RequestUtils), but the BodyInit type it references omits them.
  const response = await fetch(url, { method: 'PUT', headers, body: data as unknown as BodyInit });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};

/**
 * Upload each pending media item for an already-synced interview: register
 * intent, PUT the bytes direct to storage, then complete. Media bytes live only
 * inside the encrypted store, so they are read from their blob chunks and sent
 * from memory — never through a plaintext temp file — and deleted from the
 * device once the server has them. Per-item failures are counted and left
 * pending to retry; the batch never throws.
 */
export async function uploadMedia(
  db: SQLiteDatabase,
  uploadBytes: BytesUploader = uploadViaFetch
): Promise<MediaUploadSummary> {
  const pending = await listPendingMedia(db);
  const summary: MediaUploadSummary = { uploaded: 0, failed: 0 };

  for (const media of pending) {
    try {
      const data = await readMediaBytes(db, media.client_id);
      if (!data) {
        summary.failed += 1;
        continue;
      }

      const intent = await api.mediaIntent(media.instance_id, {
        client_id: media.client_id,
        kind: media.kind as MediaKind,
        content_type: media.content_type ?? 'application/octet-stream',
        byte_size: data.byteLength,
      });

      await uploadBytes(intent.upload_url, data, intent.headers);

      await api.mediaComplete(media.instance_id, {
        client_id: media.client_id,
        storage_key: intent.storage_key,
        duration_s: media.duration_s ?? undefined,
      });

      await setMediaUploaded(db, media.client_id, intent.storage_key);
      await deleteMediaBytes(db, media.client_id);
      summary.uploaded += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

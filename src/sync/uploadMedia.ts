import { File, UploadType } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { MediaKind } from '../api/types';
import { listPendingMedia, setMediaUploaded } from '../db/mediaRepository';

export interface MediaUploadSummary {
  uploaded: number;
  failed: number;
}

/** Uploads a local file to a presigned URL. Injectable so the engine is testable. */
export type FileUploader = (
  url: string,
  localUri: string,
  headers: Record<string, string>
) => Promise<void>;

const uploadViaFileSystem: FileUploader = async (url, localUri, headers) => {
  const result = await new File(localUri).upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers,
  });

  if (result.status >= 400) {
    throw new Error(`Upload failed with status ${result.status}`);
  }
};

/**
 * Upload each pending media file for an already-synced interview: register
 * intent, PUT the bytes direct to storage, then complete. Per-item failures are
 * counted and left pending to retry; the batch never throws.
 */
export async function uploadMedia(
  db: SQLiteDatabase,
  uploadFile: FileUploader = uploadViaFileSystem
): Promise<MediaUploadSummary> {
  const pending = await listPendingMedia(db);
  const summary: MediaUploadSummary = { uploaded: 0, failed: 0 };

  for (const media of pending) {
    if (!media.local_uri || media.byte_size == null) {
      summary.failed += 1;
      continue;
    }

    try {
      const intent = await api.mediaIntent(media.instance_id, {
        client_id: media.client_id,
        kind: media.kind as MediaKind,
        content_type: media.content_type ?? 'application/octet-stream',
        byte_size: media.byte_size,
      });

      await uploadFile(intent.upload_url, media.local_uri, intent.headers);

      await api.mediaComplete(media.instance_id, {
        client_id: media.client_id,
        storage_key: intent.storage_key,
        duration_s: media.duration_s ?? undefined,
      });

      await setMediaUploaded(db, media.client_id, intent.storage_key);
      summary.uploaded += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

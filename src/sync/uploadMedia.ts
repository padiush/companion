import { fetch } from 'expo/fetch';
import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { MediaCompleteRequest, MediaIntentRequest, MediaKind } from '../api/types';
import {
  deleteMediaBytes,
  listPendingMedia,
  readMediaBytes,
  recordUploadFailure,
  setMediaUploaded,
  type UploadableMediaRow,
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
 * Upload each pending media item whose owner the server already has — an
 * interview that has synced, or a field record with a server id: register
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
        // The row exists but its bytes do not — nothing to retry, and the
        // reason is worth keeping rather than counting anonymously.
        await recordUploadFailure(db, media.client_id, 'media.errors.bytesMissing');
        summary.failed += 1;
        continue;
      }

      const owner = ownerEndpoints(media);
      if (!owner) {
        // Listed as uploadable but owned by neither — a row the store's
        // one-owner rule should have made impossible. Kept, and reported.
        await recordUploadFailure(db, media.client_id, 'media.errors.noOwner');
        summary.failed += 1;
        continue;
      }

      const intent = await owner.intent({
        client_id: media.client_id,
        kind: media.kind as MediaKind,
        content_type: media.content_type ?? 'application/octet-stream',
        byte_size: data.byteLength,
      });

      await uploadBytes(intent.upload_url, data, requestHeaders(intent.headers));

      await owner.complete({
        client_id: media.client_id,
        storage_key: intent.storage_key,
        duration_s: media.duration_s ?? undefined,
      });

      await setMediaUploaded(db, media.client_id, intent.storage_key);
      await deleteMediaBytes(db, media.client_id);
      summary.uploaded += 1;
    } catch (error) {
      // Still pending, so the next send retries it — but the attempt and the
      // reason are recorded, so an upload failing every time is visible rather
      // than looking like one that has simply not been tried yet.
      await recordUploadFailure(db, media.client_id, describe(error));
      summary.failed += 1;
    }
  }

  return summary;
}

/**
 * The headers the PUT is actually sent with: one string per header, and no
 * `Host`.
 *
 * A server that hands back a storage SDK's signed headers unconverted gives
 * every value as a list. The native fetch takes strings and nothing else, so a
 * single list value made every upload fail before a byte left the phone.
 * `Host` is dropped because the HTTP client sets it from the URL, which is the
 * host the signature covers; an explicit one adds nothing but a way to
 * disagree with it.
 */
export function requestHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() === 'host') {
      continue;
    }
    flat[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return flat;
}

/**
 * Where a file goes: its interview's endpoints, by the id the device minted,
 * or its field record's, by the id the server gave the record.
 */
function ownerEndpoints(media: UploadableMediaRow) {
  const instanceId = media.instance_id;
  if (instanceId) {
    return {
      intent: (payload: MediaIntentRequest) => api.mediaIntent(instanceId, payload),
      complete: (payload: MediaCompleteRequest) => api.mediaComplete(instanceId, payload),
    };
  }

  const recordId = media.record_server_id;
  if (recordId !== null) {
    return {
      intent: (payload: MediaIntentRequest) => api.recordMediaIntent(recordId, payload),
      complete: (payload: MediaCompleteRequest) => api.recordMediaComplete(recordId, payload),
    };
  }

  return null;
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

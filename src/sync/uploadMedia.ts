import { fetch } from 'expo/fetch';
import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError, api } from '../api/client';
import type {
  MediaCompleteRequest,
  MediaIntentRequest,
  MediaIntentResponse,
  MediaKind,
  MediaPartsRequest,
  MultipartUploadIntent,
  SingleUploadIntent,
} from '../api/types';
import {
  deleteMediaBytes,
  listPendingMedia,
  mediaByteSize,
  readMediaBytes,
  readMediaRange,
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
 * How long part URLs are used before asking for fresh ones. The server signs
 * them for fifteen minutes; asking again after ten keeps a slow part from
 * starting on a URL about to expire. Measured on the device's own clock from
 * when the URLs arrived, so a phone set to the wrong time does not matter.
 */
const PART_URLS_FRESH_MS = 10 * 60 * 1000;

/**
 * Upload each pending media item whose owner the server already has — an
 * interview that has synced, or a field record with a server id: register
 * intent, send the bytes direct to storage, then complete. Media bytes live
 * only inside the encrypted store, so they are read from their blob chunks and
 * sent from memory — never through a plaintext temp file — and deleted from the
 * device once the server has them. Per-item failures are counted and left
 * pending to retry; the batch never throws.
 *
 * Every intent asks to resume. A file larger than one part then goes up in
 * parts, and a send interrupted halfway picks up from the parts storage
 * already holds — the server keeps that record, so the device keeps nothing
 * new (the platform's docs/decisions/0012-resumable-media-upload.md).
 */
export async function uploadMedia(
  db: SQLiteDatabase,
  uploadBytes: BytesUploader = uploadViaFetch,
  now: () => number = Date.now
): Promise<MediaUploadSummary> {
  const pending = await listPendingMedia(db);
  const summary: MediaUploadSummary = { uploaded: 0, failed: 0 };

  for (const media of pending) {
    try {
      const byteSize = await mediaByteSize(db, media.client_id);
      if (byteSize === 0) {
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

      const storageKey = await send(db, owner, media, byteSize, uploadBytes, now);

      await setMediaUploaded(db, media.client_id, storageKey);
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

type OwnerEndpoints = NonNullable<ReturnType<typeof ownerEndpoints>>;

/**
 * Register, send and complete one file, returning the storage key it landed
 * under.
 *
 * Storage drops an upload left unfinished for days. When that turns out to
 * have happened, the parts sent before are gone and the only way on is a new
 * upload — so this starts one, once. A second expiry in the same send is left
 * for the next.
 */
async function send(
  db: SQLiteDatabase,
  owner: OwnerEndpoints,
  media: UploadableMediaRow,
  byteSize: number,
  uploadBytes: BytesUploader,
  now: () => number
): Promise<string> {
  const announce: MediaIntentRequest = {
    client_id: media.client_id,
    kind: media.kind as MediaKind,
    content_type: media.content_type ?? 'application/octet-stream',
    byte_size: byteSize,
    resumable: true,
  };

  for (let attempt = 0; ; attempt++) {
    const intent = await owner.intent(announce);

    try {
      if (isMultipartIntent(intent)) {
        await sendParts(db, owner, media.client_id, intent, uploadBytes, now);
      } else {
        await sendWhole(db, media.client_id, intent, uploadBytes);
      }

      await owner.complete({
        client_id: media.client_id,
        storage_key: intent.storage_key,
        duration_s: media.duration_s ?? undefined,
      });

      return intent.storage_key;
    } catch (error) {
      if (attempt === 0 && isUploadExpired(error)) {
        continue;
      }
      throw error;
    }
  }
}

/** The whole file in one PUT: a small file, or a server that does not resume. */
async function sendWhole(
  db: SQLiteDatabase,
  clientId: string,
  intent: SingleUploadIntent,
  uploadBytes: BytesUploader
): Promise<void> {
  const data = await readMediaBytes(db, clientId);
  if (!data) {
    throw new Error('media.errors.bytesMissing');
  }

  await uploadBytes(intent.upload_url, data, requestHeaders(intent.headers));
}

/**
 * Send the parts storage does not hold yet, one at a time, until the server
 * says none are missing. Each part is read from the store as it is sent, so
 * only one part is ever in memory, whatever the length of the recording.
 *
 * A failed part ends the send; the next one asks again and sends only what is
 * still missing. Every round sends at least one part, so a file of n parts
 * needs at most n rounds — more means storage keeps refusing a part, and the
 * loop stops rather than spinning.
 */
async function sendParts(
  db: SQLiteDatabase,
  owner: OwnerEndpoints,
  clientId: string,
  intent: MultipartUploadIntent,
  uploadBytes: BytesUploader,
  now: () => number
): Promise<void> {
  const { part_size: partSize, part_count: partCount } = intent.upload;
  const ask: MediaPartsRequest = { client_id: clientId, storage_key: intent.storage_key };

  for (let round = 0; round <= partCount; round++) {
    const { parts } = await owner.parts(ask);
    if (parts.length === 0) {
      return;
    }

    const issuedAt = now();
    for (const [index, part] of parts.entries()) {
      if (index > 0 && now() - issuedAt > PART_URLS_FRESH_MS) {
        break;
      }

      const bytes = await readMediaRange(db, clientId, (part.number - 1) * partSize, partSize);
      await uploadBytes(part.url, bytes, requestHeaders(part.headers));
    }
  }

  throw new Error('media.errors.partsNotAccepted');
}

function isMultipartIntent(intent: MediaIntentResponse): intent is MultipartUploadIntent {
  return intent.upload?.mode === 'multipart';
}

/** Storage no longer has the upload; a new intent starts another. */
function isUploadExpired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 410 &&
    error.body?.message === 'api.media.upload_expired'
  );
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
      parts: (payload: MediaPartsRequest) => api.mediaParts(instanceId, payload),
      complete: (payload: MediaCompleteRequest) => api.mediaComplete(instanceId, payload),
    };
  }

  const recordId = media.record_server_id;
  if (recordId !== null) {
    return {
      intent: (payload: MediaIntentRequest) => api.recordMediaIntent(recordId, payload),
      parts: (payload: MediaPartsRequest) => api.recordMediaParts(recordId, payload),
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

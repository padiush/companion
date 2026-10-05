import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError, api } from '../api/client';
import {
  deleteMediaBytes,
  listPendingMedia,
  mediaByteSize,
  readMediaBytes,
  readMediaRange,
  recordUploadFailure,
  setMediaUploaded,
} from '../db/mediaRepository';
import type { UploadableMediaRow } from '../db/mediaRepository';
import { requestHeaders, uploadMedia } from './uploadMedia';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../api/client', () => ({
  ApiError: jest.requireActual('../api/client').ApiError,
  api: {
    mediaIntent: jest.fn(),
    mediaParts: jest.fn(),
    mediaComplete: jest.fn(),
    recordMediaIntent: jest.fn(),
    recordMediaParts: jest.fn(),
    recordMediaComplete: jest.fn(),
  },
}));
jest.mock('../db/mediaRepository', () => ({
  listPendingMedia: jest.fn(),
  mediaByteSize: jest.fn(),
  readMediaBytes: jest.fn(),
  readMediaRange: jest.fn(),
  deleteMediaBytes: jest.fn(),
  setMediaUploaded: jest.fn(),
  recordUploadFailure: jest.fn(),
}));

const mockIntent = api.mediaIntent as jest.Mock;
const mockComplete = api.mediaComplete as jest.Mock;
const mockList = listPendingMedia as jest.Mock;
const mockRead = readMediaBytes as jest.Mock;
const mockSize = mediaByteSize as jest.Mock;
const mockRange = readMediaRange as jest.Mock;
const mockParts = api.mediaParts as jest.Mock;

const db = {} as SQLiteDatabase;

function media(overrides: Partial<UploadableMediaRow> = {}): UploadableMediaRow {
  return {
    record_server_id: null,
    client_id: 'm1',
    instance_id: 'inst-1',
    field_record_id: null,
    kind: 'photo',
    local_uri: null,
    storage_key: null,
    content_type: 'image/jpeg',
    byte_size: 1234,
    duration_s: null,
    upload_status: 'pending',
    transcription_status: null,
    captured_at: '2026-07-13T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // The size the store reports is the size of whatever bytes a test stored.
  mockSize.mockImplementation(
    async (database: SQLiteDatabase, clientId: string) =>
      ((await mockRead(database, clientId)) as Uint8Array | null)?.byteLength ?? 0
  );
});

describe('uploadMedia', () => {
  it('registers intent, uploads the bytes, completes, and clears them from the store', async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(bytes);
    mockIntent.mockResolvedValue({
      upload_url: 'https://storage/p.jpg',
      headers: { 'Content-Type': 'image/jpeg' },
      storage_key: 'projects/9/p.jpg',
      expires_at: 'x',
    });
    mockComplete.mockResolvedValue({ id: 1, status: 'stored' });
    const uploadBytes = jest.fn().mockResolvedValue(undefined);

    const summary = await uploadMedia(db, uploadBytes);

    // byte_size comes from the stored bytes, not the row.
    expect(mockIntent).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      kind: 'photo',
      content_type: 'image/jpeg',
      byte_size: 3,
      resumable: true,
    });
    expect(uploadBytes).toHaveBeenCalledWith('https://storage/p.jpg', bytes, {
      'Content-Type': 'image/jpeg',
    });
    expect(mockComplete).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      storage_key: 'projects/9/p.jpg',
      duration_s: undefined,
    });
    expect(setMediaUploaded).toHaveBeenCalledWith(db, 'm1', 'projects/9/p.jpg');
    expect(deleteMediaBytes).toHaveBeenCalledWith(db, 'm1');
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('counts a failed upload, keeping the bytes to retry', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(Uint8Array.from([1]));
    mockIntent.mockResolvedValue({
      upload_url: 'u',
      headers: {},
      storage_key: 'k',
      expires_at: 'x',
    });
    const uploadBytes = jest.fn().mockRejectedValue(new Error('offline'));

    const summary = await uploadMedia(db, uploadBytes);

    expect(mockComplete).not.toHaveBeenCalled();
    expect(setMediaUploaded).not.toHaveBeenCalled();
    expect(deleteMediaBytes).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  it('skips media that has no stored bytes', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(null);
    const uploadBytes = jest.fn();

    const summary = await uploadMedia(db, uploadBytes);

    expect(uploadBytes).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });
});

describe('a large file sent in parts', () => {
  /** 20 bytes in parts of 8: two full parts and a last one of 4. */
  const multipart = {
    storage_key: 'projects/9/a.m4a',
    upload: { mode: 'multipart', part_size: 8, part_count: 3 },
  };
  const part = (number: number, url = `https://storage/part-${number}`) => ({
    number,
    url,
    headers: {},
  });
  const expired = () =>
    new ApiError(410, { message: 'api.media.upload_expired', message_type: 'error' });

  beforeEach(() => {
    mockList.mockResolvedValue([media({ kind: 'audio', content_type: 'audio/mp4' })]);
    mockSize.mockResolvedValue(20);
    mockRange.mockImplementation(async (_db: SQLiteDatabase, _id: string, offset: number) =>
      Uint8Array.from([offset])
    );
    mockIntent.mockResolvedValue(multipart);
    mockComplete.mockResolvedValue({ id: 1, status: 'stored' });
  });

  /** What is left after a dropped connection: storage already has part 1. */
  it('sends only the parts the server says are missing, then completes', async () => {
    mockParts.mockResolvedValueOnce({ parts: [part(2), part(3)], expires_at: 'x' });
    mockParts.mockResolvedValueOnce({ parts: [], expires_at: 'x' });
    const uploadBytes = jest.fn().mockResolvedValue(undefined);

    const summary = await uploadMedia(db, uploadBytes);

    expect(mockRange.mock.calls.map((call) => call.slice(1))).toEqual([
      ['m1', 8, 8],
      ['m1', 16, 8],
    ]);
    expect(uploadBytes.mock.calls.map((call) => call[0])).toEqual([
      'https://storage/part-2',
      'https://storage/part-3',
    ]);
    expect(mockParts).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      storage_key: 'projects/9/a.m4a',
    });
    expect(mockComplete).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      storage_key: 'projects/9/a.m4a',
      duration_s: undefined,
    });
    // Never the whole file at once.
    expect(mockRead).not.toHaveBeenCalled();
    expect(setMediaUploaded).toHaveBeenCalledWith(db, 'm1', 'projects/9/a.m4a');
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('stops at a part that fails, completing nothing, for the next send to resume', async () => {
    mockParts.mockResolvedValue({ parts: [part(1), part(2), part(3)], expires_at: 'x' });
    const uploadBytes = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Upload failed with status 0'));

    const summary = await uploadMedia(db, uploadBytes);

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(deleteMediaBytes).not.toHaveBeenCalled();
    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'Upload failed with status 0');
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  /** A slow link must not start a part on a URL about to expire. */
  it('asks for fresh URLs once the ones it has are ten minutes old', async () => {
    let clock = 0;
    mockParts
      .mockResolvedValueOnce({ parts: [part(1), part(2)], expires_at: 'x' })
      .mockResolvedValueOnce({ parts: [part(2, 'https://storage/part-2-fresh')], expires_at: 'x' })
      .mockResolvedValueOnce({ parts: [], expires_at: 'x' });
    const uploadBytes = jest.fn().mockImplementation(async () => {
      clock += 11 * 60 * 1000;
    });

    const summary = await uploadMedia(db, uploadBytes, () => clock);

    expect(uploadBytes.mock.calls.map((call) => call[0])).toEqual([
      'https://storage/part-1',
      'https://storage/part-2-fresh',
    ]);
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('starts a new upload when storage has dropped the old one', async () => {
    mockParts
      .mockRejectedValueOnce(expired())
      .mockResolvedValueOnce({ parts: [part(1)], expires_at: 'x' })
      .mockResolvedValueOnce({ parts: [], expires_at: 'x' });

    const summary = await uploadMedia(db, jest.fn().mockResolvedValue(undefined));

    expect(mockIntent).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('starts again only once in the same send', async () => {
    mockParts.mockRejectedValue(expired());

    const summary = await uploadMedia(db, jest.fn());

    expect(mockIntent).toHaveBeenCalledTimes(2);
    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'api.media.upload_expired');
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  it('gives up on a part storage keeps refusing instead of looping', async () => {
    mockParts.mockResolvedValue({ parts: [part(2)], expires_at: 'x' });
    const uploadBytes = jest.fn().mockResolvedValue(undefined);

    const summary = await uploadMedia(db, uploadBytes);

    // One round per part, and no more.
    expect(uploadBytes).toHaveBeenCalledTimes(4);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'media.errors.partsNotAccepted');
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  it('sends a field record’s parts to the record’s endpoint', async () => {
    mockList.mockResolvedValue([
      media({ instance_id: null, field_record_id: 'fr-1', record_server_id: 41 }),
    ]);
    (api.recordMediaIntent as jest.Mock).mockResolvedValue(multipart);
    (api.recordMediaParts as jest.Mock).mockResolvedValue({ parts: [], expires_at: null });
    (api.recordMediaComplete as jest.Mock).mockResolvedValue({ id: 7, status: 'stored' });

    const summary = await uploadMedia(db, jest.fn());

    expect(api.recordMediaParts).toHaveBeenCalledWith(41, {
      client_id: 'm1',
      storage_key: 'projects/9/a.m4a',
    });
    expect(mockParts).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });
});

describe('a field record’s photographs', () => {
  const intent = {
    upload_url: 'https://storage/r.jpg',
    headers: { 'Content-Type': 'image/jpeg' },
    storage_key: 'projects/9/field-records/41/media/m1.jpg',
    expires_at: 'x',
  };

  /** The device names a record by the id the server gave it; it minted no other. */
  it('goes to the record’s endpoints, addressed by its server id', async () => {
    mockList.mockResolvedValue([
      media({ instance_id: null, field_record_id: 'fr-1', record_server_id: 41 }),
    ]);
    mockRead.mockResolvedValue(Uint8Array.from([1, 2, 3, 4]));
    (api.recordMediaIntent as jest.Mock).mockResolvedValue(intent);
    (api.recordMediaComplete as jest.Mock).mockResolvedValue({ id: 7, status: 'stored' });

    const summary = await uploadMedia(db, jest.fn().mockResolvedValue(undefined));

    expect(api.recordMediaIntent).toHaveBeenCalledWith(41, {
      client_id: 'm1',
      kind: 'photo',
      content_type: 'image/jpeg',
      byte_size: 4,
      resumable: true,
    });
    expect(api.recordMediaComplete).toHaveBeenCalledWith(41, {
      client_id: 'm1',
      storage_key: intent.storage_key,
      duration_s: undefined,
    });
    expect(mockIntent).not.toHaveBeenCalled();
    expect(setMediaUploaded).toHaveBeenCalledWith(db, 'm1', intent.storage_key);
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('reports a file with no owner it can be sent against, rather than guessing', async () => {
    mockList.mockResolvedValue([
      media({ instance_id: null, field_record_id: 'fr-1', record_server_id: null }),
    ]);
    mockRead.mockResolvedValue(Uint8Array.from([1]));

    const summary = await uploadMedia(db, jest.fn());

    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'media.errors.noOwner');
    expect(api.recordMediaIntent).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });
});

describe('uploads that fail', () => {
  /**
   * The gap this closes: every failure was swallowed by the engine's catch, so
   * an upload failing on every attempt looked exactly like one that had never
   * been tried. Informant audio could sit on a device indefinitely with nothing
   * anywhere to say why.
   */
  it('records why an upload failed, so a stuck one is visible', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockIntent.mockRejectedValue(new Error('Upload failed with status 503'));

    const summary = await uploadMedia(db, jest.fn());

    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'Upload failed with status 503');
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  it('records a reason for media whose bytes have gone', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(null);

    await uploadMedia(db, jest.fn());

    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'media.errors.bytesMissing');
  });

  it('describes a thrown non-error rather than storing nothing', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(new Uint8Array([1]));
    mockIntent.mockRejectedValue('boom');

    await uploadMedia(db, jest.fn());

    expect(recordUploadFailure).toHaveBeenCalledWith(db, 'm1', 'boom');
  });

  it('records nothing against an upload that succeeded', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(new Uint8Array([1]));
    mockIntent.mockResolvedValue({ upload_url: 'https://x', storage_key: 'k', headers: {} });
    mockComplete.mockResolvedValue({});

    await uploadMedia(db, jest.fn());

    expect(recordUploadFailure).not.toHaveBeenCalled();
  });
});

describe('the headers an upload is sent with', () => {
  /**
   * What a server passing the storage SDK's signed headers through actually
   * returned. The native fetch rejects a list value, so every upload failed
   * before a byte was sent.
   */
  it('sends one string per header and leaves Host to the HTTP client', () => {
    expect(
      requestHeaders({
        'Content-Type': 'image/jpeg',
        Host: ['media.example.org'],
        'x-amz-meta-a': ['one', 'two'],
      })
    ).toEqual({ 'Content-Type': 'image/jpeg', 'x-amz-meta-a': 'one, two' });
  });

  it('passes the signed headers to the upload in that form', async () => {
    mockList.mockResolvedValue([media()]);
    mockRead.mockResolvedValue(Uint8Array.from([1]));
    mockIntent.mockResolvedValue({
      upload_url: 'https://storage/p.jpg',
      headers: { 'Content-Type': 'image/jpeg', Host: ['storage'] },
      storage_key: 'k',
      expires_at: 'x',
    });
    mockComplete.mockResolvedValue({ id: 1, status: 'stored' });
    const uploadBytes = jest.fn().mockResolvedValue(undefined);

    await uploadMedia(db, uploadBytes);

    expect(uploadBytes).toHaveBeenCalledWith('https://storage/p.jpg', expect.anything(), {
      'Content-Type': 'image/jpeg',
    });
  });
});

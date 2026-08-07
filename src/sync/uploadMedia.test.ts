import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import {
  deleteMediaBytes,
  listPendingMedia,
  readMediaBytes,
  recordUploadFailure,
  setMediaUploaded,
} from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { uploadMedia } from './uploadMedia';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../api/client', () => ({
  api: { mediaIntent: jest.fn(), mediaComplete: jest.fn() },
}));
jest.mock('../db/mediaRepository', () => ({
  listPendingMedia: jest.fn(),
  readMediaBytes: jest.fn(),
  deleteMediaBytes: jest.fn(),
  setMediaUploaded: jest.fn(),
  recordUploadFailure: jest.fn(),
}));

const mockIntent = api.mediaIntent as jest.Mock;
const mockComplete = api.mediaComplete as jest.Mock;
const mockList = listPendingMedia as jest.Mock;
const mockRead = readMediaBytes as jest.Mock;

const db = {} as SQLiteDatabase;

function media(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    client_id: 'm1',
    instance_id: 'inst-1',
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

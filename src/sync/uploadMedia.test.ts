import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import { listPendingMedia, setMediaUploaded } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { uploadMedia } from './uploadMedia';

jest.mock('expo-file-system', () => ({ File: class {}, UploadType: { BINARY_CONTENT: 0 } }));
jest.mock('../api/client', () => ({
  api: { mediaIntent: jest.fn(), mediaComplete: jest.fn() },
}));
jest.mock('../db/mediaRepository', () => ({
  listPendingMedia: jest.fn(),
  setMediaUploaded: jest.fn(),
}));

const mockIntent = api.mediaIntent as jest.Mock;
const mockComplete = api.mediaComplete as jest.Mock;
const mockList = listPendingMedia as jest.Mock;

const db = {} as SQLiteDatabase;

function media(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    client_id: 'm1',
    instance_id: 'inst-1',
    kind: 'photo',
    local_uri: 'file:///p.jpg',
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
  it('registers intent, uploads the file, completes, and marks it uploaded', async () => {
    mockList.mockResolvedValue([media()]);
    mockIntent.mockResolvedValue({
      upload_url: 'https://storage/p.jpg',
      headers: { 'Content-Type': 'image/jpeg' },
      storage_key: 'projects/9/p.jpg',
      expires_at: 'x',
    });
    mockComplete.mockResolvedValue({ id: 1, status: 'stored' });
    const uploadFile = jest.fn().mockResolvedValue(undefined);

    const summary = await uploadMedia(db, uploadFile);

    expect(mockIntent).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      kind: 'photo',
      content_type: 'image/jpeg',
      byte_size: 1234,
    });
    expect(uploadFile).toHaveBeenCalledWith('https://storage/p.jpg', 'file:///p.jpg', {
      'Content-Type': 'image/jpeg',
    });
    expect(mockComplete).toHaveBeenCalledWith('inst-1', {
      client_id: 'm1',
      storage_key: 'projects/9/p.jpg',
      duration_s: undefined,
    });
    expect(setMediaUploaded).toHaveBeenCalledWith(db, 'm1', 'projects/9/p.jpg');
    expect(summary).toEqual({ uploaded: 1, failed: 0 });
  });

  it('counts a failed upload and does not complete it', async () => {
    mockList.mockResolvedValue([media()]);
    mockIntent.mockResolvedValue({
      upload_url: 'u',
      headers: {},
      storage_key: 'k',
      expires_at: 'x',
    });
    const uploadFile = jest.fn().mockRejectedValue(new Error('offline'));

    const summary = await uploadMedia(db, uploadFile);

    expect(mockComplete).not.toHaveBeenCalled();
    expect(setMediaUploaded).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });

  it('skips media that has no local file', async () => {
    mockList.mockResolvedValue([media({ local_uri: null })]);
    const uploadFile = jest.fn();

    const summary = await uploadMedia(db, uploadFile);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(summary).toEqual({ uploaded: 0, failed: 1 });
  });
});

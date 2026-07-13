import type { SQLiteDatabase } from 'expo-sqlite';

import { insertMedia, insertMediaChunk } from '../db/mediaRepository';
import { attachMedia } from './mediaService';

let mockFileSize: number | null = 0;
let mockReads: Uint8Array[] = [];
const mockClose = jest.fn();
const mockDelete = jest.fn();
const mockReadBytes = jest.fn(() => mockReads.shift() ?? new Uint8Array(0));

jest.mock('expo-file-system', () => ({
  FileMode: { ReadOnly: 'r' },
  File: class {
    get size() {
      return mockFileSize;
    }
    open() {
      return { readBytes: mockReadBytes, close: mockClose };
    }
    delete() {
      mockDelete();
    }
  },
}));
jest.mock('../db/mediaRepository', () => ({
  insertMedia: jest.fn(),
  insertMediaChunk: jest.fn(),
}));
jest.mock('../ids', () => ({ uuid: jest.fn(() => 'media-uuid') }));

const CHUNK_BYTES = 4 * 1024 * 1024;

const db = {
  withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
} as unknown as SQLiteDatabase;

const params = {
  instanceId: 'inst-1',
  kind: 'photo' as const,
  localUri: 'file:///cache/p.jpg',
  contentType: 'image/jpeg',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFileSize = 0;
  mockReads = [];
});

describe('attachMedia', () => {
  it('ingests the file into blob chunks and deletes the plaintext original', async () => {
    const bytes = Uint8Array.from([7, 8, 9]);
    mockFileSize = 3;
    mockReads = [bytes];

    const id = await attachMedia(db, params);

    expect(id).toBe('media-uuid');
    expect(db.withTransactionAsync).toHaveBeenCalled();
    expect(insertMedia).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientId: 'media-uuid',
        instanceId: 'inst-1',
        kind: 'photo',
        contentType: 'image/jpeg',
        byteSize: 3,
        durationS: null,
      })
    );
    expect(insertMediaChunk).toHaveBeenCalledWith(db, 'media-uuid', 0, bytes);
    expect(mockClose).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('splits large captures across blob rows', async () => {
    const first = new Uint8Array(CHUNK_BYTES).fill(1);
    const tail = Uint8Array.from([2, 2]);
    mockFileSize = CHUNK_BYTES + 2;
    mockReads = [first, tail];

    await attachMedia(db, params);

    // Reference assertions — deep-comparing a 4 MiB array is needlessly slow.
    const calls = (insertMediaChunk as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(1)).toEqual(['media-uuid', 0, expect.anything()]);
    expect(calls[0][3]).toBe(first);
    expect(calls[1].slice(1)).toEqual(['media-uuid', 1, expect.anything()]);
    expect(calls[1][3]).toBe(tail);
  });

  it('rejects a truncated read and keeps the source file', async () => {
    mockFileSize = 10;
    mockReads = [Uint8Array.from([1])];

    await expect(attachMedia(db, params)).rejects.toThrow(/read 1 bytes, expected 10/);

    expect(mockClose).toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('still resolves when the source file cannot be deleted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFileSize = 1;
    mockReads = [Uint8Array.from([1])];
    mockDelete.mockImplementation(() => {
      throw new Error('locked');
    });

    await expect(attachMedia(db, params)).resolves.toBe('media-uuid');

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

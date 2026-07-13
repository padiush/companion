import type { SQLiteDatabase } from 'expo-sqlite';

import { insertMedia } from '../db/mediaRepository';
import { attachMedia } from './mediaService';

jest.mock('../db/mediaRepository', () => ({ insertMedia: jest.fn() }));
jest.mock('../ids', () => ({ uuid: jest.fn(() => 'media-uuid') }));

const db = {} as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('attachMedia', () => {
  it('inserts a pending media row and returns the client id', async () => {
    const id = await attachMedia(db, {
      instanceId: 'inst-1',
      kind: 'photo',
      localUri: 'file:///p.jpg',
      contentType: 'image/jpeg',
      byteSize: 1234,
    });

    expect(id).toBe('media-uuid');
    expect(insertMedia).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientId: 'media-uuid',
        instanceId: 'inst-1',
        kind: 'photo',
        localUri: 'file:///p.jpg',
        contentType: 'image/jpeg',
        byteSize: 1234,
        durationS: null,
      })
    );
  });
});

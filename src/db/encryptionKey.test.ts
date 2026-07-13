import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { getOrCreateDatabaseKey } from './encryptionKey';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;
const getRandomBytesAsync = Crypto.getRandomBytesAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOrCreateDatabaseKey', () => {
  it('returns the stored key without generating a new one', async () => {
    getItemAsync.mockResolvedValue('ab'.repeat(32));

    await expect(getOrCreateDatabaseKey()).resolves.toBe('ab'.repeat(32));
    expect(getRandomBytesAsync).not.toHaveBeenCalled();
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('generates, persists and returns a 256-bit hex key on first use', async () => {
    getItemAsync.mockResolvedValue(null);
    getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(0x5c));

    const key = await getOrCreateDatabaseKey();

    expect(getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(key).toBe('5c'.repeat(32));
    expect(setItemAsync).toHaveBeenCalledWith('padiush.db_key', key);
  });

  it('hex-encodes low bytes with a leading zero', async () => {
    getItemAsync.mockResolvedValue(null);
    getRandomBytesAsync.mockResolvedValue(Uint8Array.from([0x00, 0x0f, 0xff]));

    await expect(getOrCreateDatabaseKey()).resolves.toBe('000fff');
  });
});

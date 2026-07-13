import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * The SQLCipher key for the offline store, held in the platform secure store
 * (Keychain / Keystore) alongside the bearer token. Minted on-device on first
 * use: 32 random bytes, hex-encoded so it can be passed to `PRAGMA key` in
 * raw-key form (`x'…'`), which skips SQLCipher's passphrase KDF on every open.
 */
const DB_KEY = 'padiush.db_key';

export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY);
  if (existing) {
    return existing;
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DB_KEY, key);
  return key;
}

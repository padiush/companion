import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { attachDiagnosticsStore, detachDiagnosticsStore, recordDiagnostic } from '../diagnostics';
import { forgetDatabaseKey, getOrCreateDatabaseKey } from './encryptionKey';
import { migrate } from './schema';

const DATABASE_NAME = 'padiush.db';

/** Staging file used once when encrypting a pre-encryption plaintext store. */
const REKEY_DATABASE_NAME = 'padiush.rekey.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

/**
 * The app's single database connection, opened lazily and migrated once.
 * The store is SQLCipher-encrypted at rest — it holds informant responses
 * until they sync. Foreign keys are enabled per connection (off by default
 * in SQLite).
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabase();
  }

  return databasePromise;
}

/**
 * Destroy the capture store and the key that opens it, then leave the module
 * ready to mint both afresh on the next `getDatabase()`.
 *
 * Used when a different account signs in on this device. Deleting the file
 * rather than emptying the tables leaves no freed pages holding informant
 * responses, and dropping the key means any copy of those bytes that outlives
 * the delete cannot be read back.
 */
export async function resetDatabase(): Promise<void> {
  const opened = databasePromise;
  // Stop handing out the old connection before the file underneath it goes.
  databasePromise = null;
  detachDiagnosticsStore();

  if (opened) {
    await opened.then((db) => db.closeAsync()).catch(() => {});
  }

  await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => {});
  await forgetDatabaseKey();
}

async function openEncryptedDatabase(): Promise<SQLiteDatabase> {
  const key = await getOrCreateDatabaseKey();

  let db = await openWithKey(DATABASE_NAME, key);
  await assertSQLCipher(db);
  if (!(await isReadable(db))) {
    await db.closeAsync();
    await encryptLegacyDatabase(key);
    db = await openWithKey(DATABASE_NAME, key);
  }

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrate(db);
  // Only now is there a table to hold them — including anything raised by the
  // open itself, which is exactly when the store did not exist to write to.
  attachDiagnosticsStore(db);
  return db;
}

async function openWithKey(name: string, key: string): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(name);
  // Must be the first statement on the connection — anything earlier would
  // touch the file unkeyed.
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  return db;
}

/**
 * On a binary without SQLCipher (Expo Go, or a dev client built before the
 * `useSQLCipher` flag), `PRAGMA key` is silently ignored and the store would
 * be written in plaintext. Fail loudly instead of capturing unencrypted.
 */
async function assertSQLCipher(db: SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync('PRAGMA cipher_version;');
  if (!version) {
    throw new Error(
      'SQLCipher is missing from this binary; refusing to open the capture store unencrypted. ' +
        'Rebuild the dev client (expo run) — Expo Go cannot run this app.'
    );
  }
}

/** True when the connection can read the schema — i.e. the key fits the file. */
async function isReadable(db: SQLiteDatabase): Promise<boolean> {
  try {
    await db.getFirstAsync('SELECT count(*) FROM sqlite_master;');
    return true;
  } catch {
    return false;
  }
}

/**
 * One-time upgrade of a store written before encryption shipped. The plaintext
 * database is exported into an encrypted staging file, the plaintext file is
 * deleted, and the staging content is exported back under the canonical name
 * (SQLite cannot rename a database file, and the double export keeps this
 * within SQLite instead of reaching for filesystem APIs).
 *
 * If the file is unreadable even without a key — an encrypted store whose key
 * is gone, e.g. app data restored onto a device without its keychain — the
 * content is cryptographically unrecoverable: delete it so the app stays
 * usable rather than failing on every launch.
 */
async function encryptLegacyDatabase(key: string): Promise<void> {
  const plain = await SQLite.openDatabaseAsync(DATABASE_NAME);
  if (!(await isReadable(plain))) {
    await plain.closeAsync();
    // Unsynced interviews are being destroyed here. Nothing can be done about
    // that — the bytes are unreadable — but it must not pass unnoticed, so the
    // event is queued and reported once the fresh store exists.
    await recordDiagnostic('store_reset_unrecoverable');
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
    return;
  }

  // A leftover staging file from an interrupted upgrade is stale — the
  // plaintext original it was copied from still exists and wins.
  await SQLite.deleteDatabaseAsync(REKEY_DATABASE_NAME).catch(() => {});

  await exportDatabase(plain, REKEY_DATABASE_NAME, key);
  await plain.closeAsync();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);

  const staged = await openWithKey(REKEY_DATABASE_NAME, key);
  await exportDatabase(staged, DATABASE_NAME, key);
  await staged.closeAsync();
  await SQLite.deleteDatabaseAsync(REKEY_DATABASE_NAME);
}

/** `sqlcipher_export` copies the whole database into an attached encrypted file. */
async function exportDatabase(
  source: SQLiteDatabase,
  targetName: string,
  key: string
): Promise<void> {
  const targetPath = `${SQLite.defaultDatabaseDirectory}/${targetName}`;
  await source.execAsync(`ATTACH DATABASE '${targetPath}' AS target KEY "x'${key}'";`);
  await source.execAsync(`SELECT sqlcipher_export('target');`);
  await source.execAsync('DETACH DATABASE target;');
}

import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(async () => {}),
  defaultDatabaseDirectory: '/data/SQLite',
}));

jest.mock('./schema', () => ({
  migrate: jest.fn(async () => {}),
}));

jest.mock('./encryptionKey', () => ({
  getOrCreateDatabaseKey: jest.fn(async () => 'ab'.repeat(32)),
}));

jest.mock('../diagnostics', () => ({
  recordDiagnostic: jest.fn(async () => {}),
  attachDiagnosticsStore: jest.fn(),
  detachDiagnosticsStore: jest.fn(),
}));

const KEY = 'ab'.repeat(32);

type FakeDatabase = {
  statements: string[];
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  closeAsync: jest.Mock;
};

/**
 * A connection whose schema read succeeds or fails (wrong key / plaintext
 * mismatch), on a binary with or without SQLCipher compiled in.
 */
function fakeDatabase({
  readable = true,
  cipher = true,
}: { readable?: boolean; cipher?: boolean } = {}): FakeDatabase {
  const statements: string[] = [];
  return {
    statements,
    execAsync: jest.fn(async (sql: string) => {
      statements.push(sql);
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('cipher_version')) {
        return cipher ? { cipher_version: '4.10.0' } : null;
      }
      if (!readable) {
        throw new Error('file is not a database');
      }
      return { 'count(*)': 0 };
    }),
    closeAsync: jest.fn(async () => {}),
  };
}

/**
 * `database.ts` caches its connection in module state, so each test loads it
 * into a fresh module registry — which also re-instantiates the mocked modules.
 * Grab the mock references from the same registry the module under test sees
 * (jest.require*, because Jest's VM can't evaluate a real dynamic import()).
 */
function setup() {
  jest.resetModules();
  const sqlite = jest.requireMock<{
    openDatabaseAsync: jest.Mock;
    deleteDatabaseAsync: jest.Mock;
  }>('expo-sqlite');
  const schema = jest.requireMock<{ migrate: jest.Mock }>('./schema');
  const diagnostics = jest.requireMock<{
    recordDiagnostic: jest.Mock;
    attachDiagnosticsStore: jest.Mock;
  }>('../diagnostics');
  const database = jest.requireActual<typeof import('./database')>('./database');
  return {
    getDatabase: database.getDatabase,
    openDatabaseAsync: sqlite.openDatabaseAsync,
    deleteDatabaseAsync: sqlite.deleteDatabaseAsync,
    migrate: schema.migrate,
    recordDiagnostic: diagnostics.recordDiagnostic,
    attachDiagnosticsStore: diagnostics.attachDiagnosticsStore,
  };
}

describe('getDatabase', () => {
  it('keys the connection before anything else, then enables foreign keys and migrates', async () => {
    const { getDatabase, openDatabaseAsync, migrate } = setup();
    const db = fakeDatabase();
    openDatabaseAsync.mockResolvedValue(db);

    await expect(getDatabase()).resolves.toBe(db as unknown as SQLiteDatabase);

    expect(openDatabaseAsync).toHaveBeenCalledWith('padiush.db');
    expect(db.statements[0]).toBe(`PRAGMA key = "x'${KEY}'";`);
    expect(db.statements[1]).toBe('PRAGMA foreign_keys = ON;');
    expect(migrate).toHaveBeenCalledWith(db);
  });

  it('refuses to run on a binary without SQLCipher', async () => {
    const { getDatabase, openDatabaseAsync, deleteDatabaseAsync, migrate } = setup();
    openDatabaseAsync.mockResolvedValue(fakeDatabase({ cipher: false }));

    await expect(getDatabase()).rejects.toThrow(/SQLCipher is missing/);

    expect(migrate).not.toHaveBeenCalled();
    expect(deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('opens the connection once and reuses it', async () => {
    const { getDatabase, openDatabaseAsync } = setup();
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const [first, second] = await Promise.all([getDatabase(), getDatabase()]);

    expect(first).toBe(second);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('encrypts a legacy plaintext store in place, then opens it with the key', async () => {
    const { getDatabase, openDatabaseAsync, deleteDatabaseAsync, migrate } = setup();
    const keyedMiss = fakeDatabase({ readable: false });
    const plaintext = fakeDatabase();
    const staged = fakeDatabase();
    const reopened = fakeDatabase();
    openDatabaseAsync
      .mockResolvedValueOnce(keyedMiss)
      .mockResolvedValueOnce(plaintext)
      .mockResolvedValueOnce(staged)
      .mockResolvedValueOnce(reopened);

    await expect(getDatabase()).resolves.toBe(reopened as unknown as SQLiteDatabase);

    // The failed keyed attempt is closed, never migrated.
    expect(keyedMiss.closeAsync).toHaveBeenCalled();

    // Plaintext content is exported into the encrypted staging file…
    expect(plaintext.statements).toEqual([
      `ATTACH DATABASE '/data/SQLite/padiush.rekey.db' AS target KEY "x'${KEY}'";`,
      `SELECT sqlcipher_export('target');`,
      'DETACH DATABASE target;',
    ]);

    // …the plaintext original is deleted, and the staging file is exported
    // back under the canonical name, keyed first.
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('padiush.db');
    expect(staged.statements).toEqual([
      `PRAGMA key = "x'${KEY}'";`,
      `ATTACH DATABASE '/data/SQLite/padiush.db' AS target KEY "x'${KEY}'";`,
      `SELECT sqlcipher_export('target');`,
      'DETACH DATABASE target;',
    ]);
    expect(deleteDatabaseAsync).toHaveBeenLastCalledWith('padiush.rekey.db');

    expect(reopened.statements[0]).toBe(`PRAGMA key = "x'${KEY}'";`);
    expect(migrate).toHaveBeenCalledWith(reopened);
  });

  it('resets a store that is unreadable both with and without the key', async () => {
    const {
      getDatabase,
      openDatabaseAsync,
      deleteDatabaseAsync,
      migrate,
      recordDiagnostic,
      attachDiagnosticsStore,
    } = setup();
    const keyedMiss = fakeDatabase({ readable: false });
    const plaintextMiss = fakeDatabase({ readable: false });
    const fresh = fakeDatabase();
    openDatabaseAsync
      .mockResolvedValueOnce(keyedMiss)
      .mockResolvedValueOnce(plaintextMiss)
      .mockResolvedValueOnce(fresh);

    await expect(getDatabase()).resolves.toBe(fresh as unknown as SQLiteDatabase);

    expect(plaintextMiss.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('sqlcipher_export')
    );
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('padiush.db');
    expect(migrate).toHaveBeenCalledWith(fresh);
    // Unsynced interviews were just destroyed. Nothing can recover them, but
    // it must not pass unnoticed — and the report is queued against the fresh
    // store, which only exists after the migration above.
    expect(recordDiagnostic).toHaveBeenCalledWith('store_reset_unrecoverable');
    expect(attachDiagnosticsStore).toHaveBeenCalledWith(fresh);
  });
});

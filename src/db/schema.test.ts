import type { SQLiteDatabase } from 'expo-sqlite';

import { SCHEMA_VERSION, migrate } from './schema';

/**
 * A connection that reports a starting `user_version` and records the SQL it
 * runs, so the runner's decisions are observable without real SQLite.
 */
function fakeDatabase(userVersion: number) {
  const statements: string[] = [];
  const db = {
    statements,
    execAsync: jest.fn(async (sql: string) => {
      statements.push(sql);
    }),
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('user_version') ? { user_version: userVersion } : null,
    ),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => {
      statements.push('BEGIN');
      await work();
      statements.push('COMMIT');
    }),
  };

  return db;
}

const run = (db: ReturnType<typeof fakeDatabase>) => migrate(db as unknown as SQLiteDatabase);

describe('migrate', () => {
  it('applies every version to a fresh store and stamps the result', async () => {
    const db = fakeDatabase(0);

    await run(db);

    expect(db.statements).toContain(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    expect(db.statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS instances'))).toBe(
      true,
    );
  });

  it('applies each version inside a transaction with its version stamp', async () => {
    const db = fakeDatabase(0);

    await run(db);

    // Nothing is stamped outside a transaction, so an interrupted upgrade
    // cannot leave the store claiming a version it did not reach.
    const stamp = db.statements.indexOf(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    expect(db.statements.lastIndexOf('BEGIN')).toBeLessThan(stamp);
    expect(db.statements.indexOf('COMMIT')).toBeGreaterThan(stamp);
  });

  it('does nothing when the store is already at the current version', async () => {
    const db = fakeDatabase(SCHEMA_VERSION);

    await run(db);

    expect(db.execAsync).not.toHaveBeenCalled();
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('skips versions the store has already applied', async () => {
    const db = fakeDatabase(1);

    await run(db);

    expect(db.statements).not.toContain('PRAGMA user_version = 1;');
  });

  /**
   * Stores written before this runner existed hold the v1 tables but report
   * version 0, so v1 is replayed over them on the next launch. It must be a
   * no-op rather than an error — hence every v1 statement being IF NOT EXISTS.
   */
  it('replays version 1 idempotently, for stores created before the runner', async () => {
    const db = fakeDatabase(0);

    await run(db);

    const v1 = db.statements.find((sql) => sql.includes('CREATE TABLE'));
    const creates = v1?.match(/CREATE (TABLE|INDEX)(?! IF NOT EXISTS)/g);
    expect(creates).toBeNull();
  });
});

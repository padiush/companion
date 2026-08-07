import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { adapt } from '../../test-utils/sqliteDatabase';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from './schema';

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
    let open = false;
    const stamps: string[] = [];

    for (const statement of db.statements) {
      if (statement === 'BEGIN') open = true;
      else if (statement === 'COMMIT') open = false;
      else if (statement.startsWith('PRAGMA user_version =')) {
        expect(open).toBe(true);
        stamps.push(statement);
      }
    }

    expect(stamps).toHaveLength(SCHEMA_VERSION);
    expect(stamps.at(-1)).toBe(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    expect(open).toBe(false);
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
    // …but still applies the ones it has not.
    expect(db.statements).toContain('PRAGMA user_version = 2;');
  });

  /**
   * A column added after v1 must arrive by ALTER, not by editing v1 — stores
   * already at v1 never replay it, so a change made there reaches new installs
   * only and the two shapes silently diverge.
   */
  it('adds later columns with ALTER rather than by editing version 1', async () => {
    const db = fakeDatabase(1);

    await run(db);

    const applied = db.statements.filter((sql) => sql.includes('ALTER TABLE'));
    expect(applied.length).toBeGreaterThan(0);
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

/**
 * The upgrade path every existing install takes, run against a real engine
 * rather than a recording fake: a store holding data at an earlier version must
 * come forward without losing any of it.
 */
describe('upgrading a store that already holds captures', () => {
  it('reaches the current version and keeps the data', async () => {
    const engine = new DatabaseSync(':memory:');
    const db = adapt(engine);

    // Stop at version 1, the shape before the sync-error columns existed.
    await db.execAsync(MIGRATIONS[0].sql);
    await db.execAsync('PRAGMA user_version = 1;');
    await db.runAsync(
      `INSERT INTO instances (id, form_id, project_id, sync_status, created_at, updated_at)
       VALUES ('kept', 10, 1, 'draft', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`,
    );
    await db.runAsync(
      `INSERT INTO answers (client_id, instance_id, section_id, item_id, value, edited_at)
       VALUES ('a-1', 'kept', 1, 1, 'Sábila', '2026-08-01T00:00:00Z')`,
    );

    await migrate(db);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(SCHEMA_VERSION);

    // The unsent interview and its answer survive the upgrade…
    await expect(db.getAllAsync('SELECT id FROM instances')).resolves.toEqual([{ id: 'kept' }]);
    // …and the columns added since are there, empty, ready to be written.
    await expect(
      db.getFirstAsync('SELECT sync_error FROM answers WHERE client_id = ?', ['a-1']),
    ).resolves.toEqual({ sync_error: null });

    await db.closeAsync();
  });

  it('is safe to run again once it is up to date', async () => {
    const engine = new DatabaseSync(':memory:');
    const db = adapt(engine);

    await migrate(db);
    await expect(migrate(db)).resolves.toBeUndefined();

    await db.closeAsync();
  });
});

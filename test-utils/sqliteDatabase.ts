import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '../src/db/schema';

/**
 * A real SQLite engine behind the slice of the `expo-sqlite` interface the
 * repositories use, so repository SQL can be tested in Node.
 *
 * expo-sqlite is a native module and cannot load under jest, which left every
 * repository's SQL verifiable only by running the app on a device. Node 22
 * ships `node:sqlite`, so the same statements can run against a real in-memory
 * database with no new dependency and no production code aware of it.
 *
 * What this does NOT cover: SQLCipher (`PRAGMA key`, `sqlcipher_export`) is not
 * compiled into Node's SQLite, so the encryption path in `database.ts` stays
 * covered by its own mocked tests and by device testing.
 */

type Param = string | number | null | Uint8Array;

/**
 * expo-sqlite accepts JS booleans and `undefined` in its parameter arrays and
 * normalizes them; node:sqlite rejects both, so narrow them the same way here
 * rather than making callers care which engine they are talking to.
 */
function toParam(value: unknown): Param {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value as Param;
}

const bind = (params: readonly unknown[]) => params.map(toParam);

export interface TestDatabase extends SQLiteDatabase {
  /** Close the underlying engine. Call in afterEach to free the handle. */
  closeAsync(): Promise<void>;
}

/** Wrap a node:sqlite handle in the expo-sqlite surface the repositories call. */
export function adapt(engine: DatabaseSync): TestDatabase {
  const database = {
    execAsync: async (sql: string) => {
      engine.exec(sql);
    },

    runAsync: async (sql: string, params: readonly unknown[] = []) => {
      const result = engine.prepare(sql).run(...bind(params));
      return {
        // expo spells it lastInsertRowId; node:sqlite spells it lastInsertRowid.
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },

    getFirstAsync: async (sql: string, params: readonly unknown[] = []) =>
      // expo resolves null for an empty result; node:sqlite returns undefined.
      engine.prepare(sql).get(...bind(params)) ?? null,

    getAllAsync: async (sql: string, params: readonly unknown[] = []) =>
      engine.prepare(sql).all(...bind(params)),

    withTransactionAsync: async (work: () => Promise<void>) => {
      engine.exec('BEGIN');
      try {
        await work();
        engine.exec('COMMIT');
      } catch (error) {
        engine.exec('ROLLBACK');
        throw error;
      }
    },

    closeAsync: async () => {
      engine.close();
    },
  };

  return database as unknown as TestDatabase;
}

/**
 * An in-memory capture store, migrated to the current schema and with foreign
 * keys enforced — the same two things `getDatabase()` guarantees in the app.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const database = adapt(new DatabaseSync(':memory:'));
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await migrate(database);
  return database;
}

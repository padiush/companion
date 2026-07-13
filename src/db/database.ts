import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './schema';

const DATABASE_NAME = 'padiush.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

/**
 * The app's single database connection, opened lazily and migrated once.
 * Foreign keys are enabled per connection (off by default in SQLite).
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    });
  }

  return databasePromise;
}

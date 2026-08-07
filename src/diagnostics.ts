import Constants from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { insertDiagnostic } from './db/diagnosticsRepository';
import type { DiagnosticRow } from './db/types';
import { uuid } from './ids';

/**
 * The integrity events this app reports. A closed set on purpose: the server
 * rejects anything else, and with no message to accompany a code there is
 * nothing an informant said that could ride along. That is the whole reason
 * these go to our own server rather than to a crash-reporting vendor.
 *
 * Keep in step with the platform's `DeviceDiagnostic::CODES`.
 */
export type DiagnosticCode =
  /** The capture store could not be read with or without its key, so it was deleted. */
  | 'store_reset_unrecoverable'
  /** The local store belonged to another account and was replaced. */
  | 'store_reset_foreign_account'
  /** An unencrypted original survived ingestion into the encrypted store. */
  | 'plaintext_capture_retained'
  /** The capture cache directory could not be swept. */
  | 'capture_cache_sweep_failed';

/**
 * How many events may wait in memory for a store to become available. Two of
 * the four codes are raised *while* the store is being deleted, so there is a
 * window with nowhere to write; past this many, something is looping and
 * dropping the excess is better than growing without bound.
 */
const MAX_BUFFERED = 50;

let store: SQLiteDatabase | null = null;
const buffered: DiagnosticRow[] = [];

/**
 * Hand the recorder somewhere to write. Called once the store is open and
 * migrated — which is also when anything raised during the open itself gets
 * flushed, since that is exactly when there was no table to write to.
 */
export function attachDiagnosticsStore(db: SQLiteDatabase): void {
  store = db;
  void drain();
}

/** Let go of a store that is being closed or deleted. */
export function detachDiagnosticsStore(): void {
  store = null;
}

/**
 * Note that an integrity event happened. Safe to call from anywhere, including
 * from inside the database open path before a store exists, and it never
 * throws — every caller is already handling a failure and must not acquire a
 * second one from reporting the first.
 */
export async function recordDiagnostic(code: DiagnosticCode): Promise<void> {
  try {
    if (buffered.length >= MAX_BUFFERED) {
      return;
    }

    buffered.push({
      client_id: uuid(),
      code,
      occurred_at: new Date().toISOString(),
      app_version: Constants.expoConfig?.version ?? null,
      // The server takes android or ios; anything else travels as unknown
      // rather than being rejected on arrival.
      platform: Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null,
      os_version: Platform.Version == null ? null : String(Platform.Version),
    });

    await drain();
  } catch {
    // Reporting a problem must never become one.
  }
}

/**
 * Move what is buffered into the store, oldest first. A write that fails
 * leaves the event and everything after it in memory to be retried, rather
 * than losing the record of a store that just deleted itself.
 */
async function drain(): Promise<void> {
  const db = store;
  if (!db) {
    return;
  }

  while (buffered.length > 0) {
    try {
      await insertDiagnostic(db, buffered[0]);
    } catch {
      return;
    }

    buffered.shift();
  }
}

/** Test seam: how many events are waiting on a store to appear. */
export function bufferedDiagnosticCount(): number {
  return buffered.length;
}

/** Test seam: drop in-memory state between cases. */
export function resetDiagnosticsForTest(): void {
  store = null;
  buffered.length = 0;
}

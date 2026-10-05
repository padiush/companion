import type { SQLiteDatabase } from 'expo-sqlite';
import type { TFunction } from 'i18next';

import { getMeta, setMeta } from '../db/syncMetaRepository';

/**
 * When this device last reached the server and got an answer it could use:
 * a pull of the projects, or a send. Shown as "Synced 5 min ago", so a
 * researcher can tell at a glance whether what is on the phone is current and
 * whether their work has gone.
 */
const KEY = 'sync.last_success_at';

/**
 * Note a successful sync. Best effort: failing to write down when it happened
 * must not turn a sync that worked into one reported as failed.
 */
export async function recordSyncSuccess(db: SQLiteDatabase, at: Date = new Date()): Promise<void> {
  try {
    await setMeta(db, KEY, at.toISOString());
  } catch {
    // The next sync writes it again.
  }
}

export async function lastSyncAt(db: SQLiteDatabase): Promise<Date | null> {
  const value = await getMeta(db, KEY);
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * How long ago, in words: just now, minutes, hours, then the day. Worked out
 * here rather than with `Intl.RelativeTimeFormat`, which Hermes does not have.
 */
export function describeLastSync(
  at: Date | null,
  t: TFunction,
  language: string,
  now: Date = new Date()
): string {
  if (!at) {
    return t('home.neverSynced');
  }

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) {
    return t('home.syncedJustNow');
  }
  if (minutes < 60) {
    return t('home.syncedMinutes', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('home.syncedHours', { count: hours });
  }

  return t('home.syncedOn', {
    date: at.toLocaleDateString(language, { day: 'numeric', month: 'short' }),
  });
}

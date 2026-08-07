import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta, setMeta } from './syncMetaRepository';

/**
 * Which account's data the local store holds.
 *
 * The store has no per-row owner: a device belongs to one researcher at a time,
 * and a second researcher signing in wipes it rather than sharing it (see
 * `claimStoreFor`). This key is what makes that decision possible, and it lives
 * in the store itself rather than in the session cache because signing out
 * clears the session but deliberately keeps the data.
 */
const OWNER_KEY = 'owner_user_id';

export interface PendingWork {
  /** Interviews captured on this device that the server has not accepted. */
  interviews: number;
  /** Media captured on this device that has not been uploaded. */
  media: number;
}

export const hasPendingWork = (work: PendingWork): boolean =>
  work.interviews > 0 || work.media > 0;

export async function readOwner(db: SQLiteDatabase): Promise<number | null> {
  const value = await getMeta(db, OWNER_KEY);

  if (value === null) {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}

export async function claimOwner(db: SQLiteDatabase, userId: number): Promise<void> {
  await setMeta(db, OWNER_KEY, String(userId));
}

/**
 * Everything captured here that the server does not have yet — what a wipe
 * would destroy, so the user can be told the cost before it happens.
 *
 * Media is counted regardless of whether its interview has synced: an uploaded
 * interview can still be holding photos or audio that never left the device.
 */
export async function countPendingWork(db: SQLiteDatabase): Promise<PendingWork> {
  const interviews = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM instances WHERE sync_status != 'synced'",
  );
  const media = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM media WHERE upload_status != 'uploaded'",
  );

  return { interviews: interviews?.count ?? 0, media: media?.count ?? 0 };
}

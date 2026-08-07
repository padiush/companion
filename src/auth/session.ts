import * as SecureStore from 'expo-secure-store';

import type { User } from '../api/types';

/**
 * The last identity the server confirmed, cached so the app can open without a
 * network. Held in the platform secure store beside the bearer token and the
 * database key — it is needed before the encrypted store is opened, and it
 * names the account whose data that store holds.
 *
 * Only the identity is cached, never credentials.
 */
const SESSION_KEY = 'padiush.session';

/**
 * How long the app will keep opening on a cached identity alone. Fieldwork can
 * run for weeks with no signal, so this is generous; it is not unbounded,
 * because the device holds unsynced informant responses and a revoked or
 * handed-over account should stop opening them eventually. Reconnecting once
 * resets the clock — nothing is deleted when it lapses.
 */
export const OFFLINE_SESSION_MAX_AGE_DAYS = 30;

const MAX_AGE_MS = OFFLINE_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface CachedSession {
  user: User;
  /** When the server last confirmed this identity (ISO-8601). */
  verifiedAt: string;
}

/** True while a cached identity may still be used to open the app offline. */
export function isWithinOfflineWindow(session: CachedSession, now: number = Date.now()): boolean {
  const verifiedAt = Date.parse(session.verifiedAt);

  if (Number.isNaN(verifiedAt)) {
    return false;
  }

  // A verification stamped in the future means the device clock moved; treat it
  // as usable rather than locking the user out over a clock change.
  return now - verifiedAt <= MAX_AGE_MS;
}

export async function readSession(): Promise<CachedSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedSession;
    return parsed?.user?.id ? parsed : null;
  } catch {
    // Unreadable cache is the same as no cache: the user signs in again.
    return null;
  }
}

/** Record an identity the server has just confirmed. */
export async function saveSession(user: User, now: Date = new Date()): Promise<void> {
  const session: CachedSession = { user, verifiedAt: now.toISOString() };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

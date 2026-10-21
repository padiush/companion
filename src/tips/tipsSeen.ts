import * as SecureStore from 'expo-secure-store';

import { TOUR_IDS, type TourId } from './tours';

/**
 * Which tours an account has been through on this device. Per account and on
 * the device, for the same reasons as the intro (`introSeen.ts`): someone new
 * on a shared phone has not seen them, and they are about this app rather
 * than the account's data.
 */
const key = (userId: number) => `padiush.tips.seen.${userId}`;

export async function readSeenTours(userId: number): Promise<Set<TourId>> {
  const raw = await SecureStore.getItemAsync(key(userId));
  if (raw === null) {
    return new Set();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    // A tour this version no longer has is dropped rather than carried along.
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is TourId => TOUR_IDS.includes(id as TourId))
        : []
    );
  } catch {
    return new Set();
  }
}

export async function writeSeenTours(userId: number, seen: ReadonlySet<TourId>): Promise<void> {
  await SecureStore.setItemAsync(key(userId), JSON.stringify([...seen]));
}

/** Forget them all, so each tour runs again on its screen. */
export async function forgetSeenTours(userId: number): Promise<void> {
  await SecureStore.deleteItemAsync(key(userId));
}

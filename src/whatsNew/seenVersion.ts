import * as SecureStore from 'expo-secure-store';

import { FIRST_RELEASE, compareVersions } from './releases';

/**
 * The last release whose notes were seen on this device. Kept outside the
 * capture store, which is per account and reset on an account switch: what
 * the app has shown belongs to the device, not to whoever is signed in.
 */
const KEY = 'padiush.whatsNew.lastSeen';

export async function readSeenVersion(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function writeSeenVersion(version: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, version);
}

/**
 * Which release the notes should start after, at launch: null when there is
 * nothing to show.
 *
 * A device that never recorded a version is either a new install or one
 * upgraded from 1.0.0, which could not record one. A session restored at
 * launch tells them apart: a new install has nobody signed in yet. A new
 * install starts on the running release, since there is nothing to catch up
 * on; an upgrade starts after 1.0.0.
 */
export async function resolveUnseenSince(
  restoredSession: boolean,
  current: string
): Promise<string | null> {
  const seen = await readSeenVersion();

  if (seen === null) {
    if (restoredSession) {
      return compareVersions(FIRST_RELEASE, current) < 0 ? FIRST_RELEASE : null;
    }
    await writeSeenVersion(current);
    return null;
  }

  return compareVersions(seen, current) < 0 ? seen : null;
}

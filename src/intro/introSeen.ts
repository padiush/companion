import * as SecureStore from 'expo-secure-store';

/**
 * Whether an account has been through the walkthrough on this device. Per
 * account, because a shared device is signed into by someone new who has not
 * seen it; on the device, because the walkthrough is about this app, not the
 * account's data, and the capture store is reset on an account switch.
 */
const key = (userId: number) => `padiush.intro.seen.${userId}`;

export async function hasSeenIntro(userId: number): Promise<boolean> {
  return (await SecureStore.getItemAsync(key(userId))) !== null;
}

export async function markIntroSeen(userId: number): Promise<void> {
  await SecureStore.setItemAsync(key(userId), '1');
}

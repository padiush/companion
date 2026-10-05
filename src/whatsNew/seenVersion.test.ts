import * as SecureStore from 'expo-secure-store';

import { readSeenVersion, resolveUnseenSince } from './seenVersion';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('resolveUnseenSince', () => {
  /** A new install has nothing to catch up on. */
  it('starts a new install on the running release, showing nothing', async () => {
    await expect(resolveUnseenSince(false, '1.1.0')).resolves.toBeNull();
    await expect(readSeenVersion()).resolves.toBe('1.1.0');
  });

  /** 1.0.0 could not record what it had shown; a session at launch means it ran. */
  it('treats a device signed in at launch with nothing recorded as upgraded from 1.0.0', async () => {
    await expect(resolveUnseenSince(true, '1.1.0')).resolves.toBe('1.0.0');
    // Recorded only once the notes are dismissed.
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('shows nothing on 1.0.0 itself', async () => {
    await expect(resolveUnseenSince(true, '1.0.0')).resolves.toBeNull();
  });

  it('starts after the last release seen', async () => {
    mockStore.set('padiush.whatsNew.lastSeen', '1.1.0');

    await expect(resolveUnseenSince(true, '1.3.0')).resolves.toBe('1.1.0');
    await expect(resolveUnseenSince(false, '1.3.0')).resolves.toBe('1.1.0');
  });

  it('shows nothing once the running release has been seen', async () => {
    mockStore.set('padiush.whatsNew.lastSeen', '1.3.0');

    await expect(resolveUnseenSince(true, '1.3.0')).resolves.toBeNull();
  });
});

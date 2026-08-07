import * as SecureStore from 'expo-secure-store';

import {
  OFFLINE_SESSION_MAX_AGE_DAYS,
  clearSession,
  isWithinOfflineWindow,
  readSession,
  saveSession,
  type CachedSession,
} from './session';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockStore = SecureStore as jest.Mocked<typeof SecureStore>;

const user = { id: 7, name: 'Field', email: 'field@example.org' };

const NOW = Date.parse('2026-08-06T12:00:00.000Z');
const at = (isoDaysAgo: number): CachedSession => ({
  user,
  verifiedAt: new Date(NOW - isoDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isWithinOfflineWindow', () => {
  it('accepts a recently confirmed identity', () => {
    expect(isWithinOfflineWindow(at(1), NOW)).toBe(true);
  });

  it('accepts one confirmed exactly at the limit', () => {
    expect(isWithinOfflineWindow(at(OFFLINE_SESSION_MAX_AGE_DAYS), NOW)).toBe(true);
  });

  it('rejects one confirmed past the limit', () => {
    expect(isWithinOfflineWindow(at(OFFLINE_SESSION_MAX_AGE_DAYS + 1), NOW)).toBe(false);
  });

  /**
   * A device whose clock jumped forward would otherwise produce a negative age
   * and read as valid, or on the way back read as ancient. Being generous here
   * is right: a wrong clock is not evidence the account went stale.
   */
  it('accepts a stamp from the future rather than locking the user out', () => {
    expect(isWithinOfflineWindow(at(-5), NOW)).toBe(true);
  });

  it('rejects an unparseable stamp', () => {
    expect(isWithinOfflineWindow({ user, verifiedAt: 'not a date' }, NOW)).toBe(false);
  });
});

describe('readSession', () => {
  it('returns the cached session', async () => {
    mockStore.getItemAsync.mockResolvedValue(JSON.stringify(at(0)));

    await expect(readSession()).resolves.toMatchObject({ user });
  });

  it('returns null when nothing is cached', async () => {
    mockStore.getItemAsync.mockResolvedValue(null);

    await expect(readSession()).resolves.toBeNull();
  });

  it('returns null for unreadable content rather than throwing at launch', async () => {
    mockStore.getItemAsync.mockResolvedValue('{ not json');

    await expect(readSession()).resolves.toBeNull();
  });

  it('returns null for a cached shape with no user', async () => {
    mockStore.getItemAsync.mockResolvedValue(JSON.stringify({ verifiedAt: at(0).verifiedAt }));

    await expect(readSession()).resolves.toBeNull();
  });
});

describe('saveSession', () => {
  it('stores the identity with the time it was confirmed', async () => {
    await saveSession(user, new Date(NOW));

    expect(mockStore.setItemAsync).toHaveBeenCalledWith(
      'padiush.session',
      JSON.stringify({ user, verifiedAt: '2026-08-06T12:00:00.000Z' }),
    );
  });

  it('never writes credentials', async () => {
    await saveSession(user, new Date(NOW));

    const [, written] = mockStore.setItemAsync.mock.calls[0];
    expect(written).not.toMatch(/password|token/i);
  });
});

describe('clearSession', () => {
  it('removes the cached identity', async () => {
    await clearSession();

    expect(mockStore.deleteItemAsync).toHaveBeenCalledWith('padiush.session');
  });
});

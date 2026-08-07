import { api, ApiError } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokens';
import { restoreSession, signIn, signOut } from './authService';
import { clearSession, readSession, saveSession, type CachedSession } from './session';

jest.mock('../api/tokens');
jest.mock('./session', () => ({
  saveSession: jest.fn(),
  clearSession: jest.fn(),
  readSession: jest.fn(),
  // The window rule is exercised directly in session.test.ts; here it is only
  // the branch that matters, so keep the real implementation.
  isWithinOfflineWindow: jest.requireActual('./session').isWithinOfflineWindow,
}));
jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return {
    __esModule: true,
    ApiError: actual.ApiError,
    api: {
      createToken: jest.fn(),
      me: jest.fn(),
      revokeCurrentToken: jest.fn(),
    },
  };
});

const mockApi = api as jest.Mocked<typeof api>;
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockReadSession = readSession as jest.MockedFunction<typeof readSession>;

const user = { id: 1, name: 'Field', email: 'field@example.org' };

const cached = (verifiedAt: string): CachedSession => ({ user, verifiedAt });

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  mockReadSession.mockResolvedValue(null);
});

describe('signIn', () => {
  it('stores the token and returns the user', async () => {
    mockApi.createToken.mockResolvedValue({ token: 'tok123', user });

    const result = await signIn('field@example.org', 'password', 'Pixel 8');

    expect(mockApi.createToken).toHaveBeenCalledWith({
      email: 'field@example.org',
      password: 'password',
      device_name: 'Pixel 8',
    });
    expect(setToken).toHaveBeenCalledWith('tok123');
    expect(saveSession).toHaveBeenCalledWith(user);
    expect(result).toEqual(user);
  });

  it('does not store a token when credentials are rejected', async () => {
    mockApi.createToken.mockRejectedValue(
      new ApiError(422, { message: 'api.tokens.invalid_credentials', message_type: 'error' })
    );

    await expect(signIn('field@example.org', 'wrong', 'Pixel 8')).rejects.toBeInstanceOf(ApiError);
    expect(setToken).not.toHaveBeenCalled();
  });
});

describe('restoreSession', () => {
  it('returns null when there is no stored token', async () => {
    mockGetToken.mockResolvedValue(null);

    expect(await restoreSession()).toBeNull();
    expect(mockApi.me).not.toHaveBeenCalled();
  });

  it('returns the user when the stored token is valid, and re-stamps the cache', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockApi.me.mockResolvedValue({ user, projects: [] });

    expect(await restoreSession()).toEqual({ user, offline: false });
    expect(saveSession).toHaveBeenCalledWith(user);
  });

  it('clears an unauthenticated token and its cached identity', async () => {
    mockGetToken.mockResolvedValue('stale');
    mockReadSession.mockResolvedValue(cached(daysAgo(0)));
    mockApi.me.mockRejectedValue(
      new ApiError(401, { message: 'api.unauthenticated', message_type: 'error' })
    );

    expect(await restoreSession()).toBeNull();
    expect(clearToken).toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalled();
  });

  /**
   * The gap this closes: any non-401 failure used to drop the user at the
   * sign-in screen, so force-quitting with no signal stranded cached forms and
   * unsent drafts behind a login they could not complete.
   */
  it('opens on the cached identity when the server is unreachable', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockReadSession.mockResolvedValue(cached(daysAgo(3)));
    mockApi.me.mockRejectedValue(new Error('network down'));

    expect(await restoreSession()).toEqual({ user, offline: true });
    expect(clearToken).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('treats a server error the same as being offline', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockReadSession.mockResolvedValue(cached(daysAgo(1)));
    mockApi.me.mockRejectedValue(
      new ApiError(500, { message: 'api.server_error', message_type: 'error' })
    );

    expect(await restoreSession()).toEqual({ user, offline: true });
    expect(clearToken).not.toHaveBeenCalled();
  });

  it('asks for a real sign-in once the cached identity is too old', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockReadSession.mockResolvedValue(cached(daysAgo(31)));
    mockApi.me.mockRejectedValue(new Error('network down'));

    expect(await restoreSession()).toBeNull();
    // The token and the local store survive: reconnecting once restores
    // everything, so nothing captured is lost to an expired window.
    expect(clearToken).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('cannot open offline with no cached identity', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockReadSession.mockResolvedValue(null);
    mockApi.me.mockRejectedValue(new Error('network down'));

    expect(await restoreSession()).toBeNull();
  });
});

describe('signOut', () => {
  it('revokes and clears the token', async () => {
    mockApi.revokeCurrentToken.mockResolvedValue({ message: 'ok' });

    await signOut();

    expect(mockApi.revokeCurrentToken).toHaveBeenCalled();
    expect(clearToken).toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalled();
  });

  it('still clears locally when revoke fails', async () => {
    mockApi.revokeCurrentToken.mockRejectedValue(new Error('offline'));

    await signOut();

    expect(clearToken).toHaveBeenCalled();
  });
});

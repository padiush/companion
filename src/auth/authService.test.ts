import { api, ApiError } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokens';
import { restoreSession, signIn, signOut } from './authService';

jest.mock('../api/tokens');
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

const user = { id: 1, name: 'Field', email: 'field@example.org' };

beforeEach(() => {
  jest.clearAllMocks();
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

  it('returns the user when the stored token is valid', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockApi.me.mockResolvedValue({ user, projects: [] });

    expect(await restoreSession()).toEqual(user);
  });

  it('clears an unauthenticated token and returns null', async () => {
    mockGetToken.mockResolvedValue('stale');
    mockApi.me.mockRejectedValue(
      new ApiError(401, { message: 'api.unauthenticated', message_type: 'error' })
    );

    expect(await restoreSession()).toBeNull();
    expect(clearToken).toHaveBeenCalled();
  });

  it('keeps the token on a network error (offline)', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockApi.me.mockRejectedValue(new Error('network down'));

    await expect(restoreSession()).rejects.toThrow('network down');
    expect(clearToken).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('revokes and clears the token', async () => {
    mockApi.revokeCurrentToken.mockResolvedValue({ message: 'ok' });

    await signOut();

    expect(mockApi.revokeCurrentToken).toHaveBeenCalled();
    expect(clearToken).toHaveBeenCalled();
  });

  it('still clears locally when revoke fails', async () => {
    mockApi.revokeCurrentToken.mockRejectedValue(new Error('offline'));

    await signOut();

    expect(clearToken).toHaveBeenCalled();
  });
});

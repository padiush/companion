import { api, ApiError } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokens';
import type { User } from '../api/types';

/**
 * The authentication logic, kept free of React so it can be unit-tested
 * directly. The AuthContext is a thin state wrapper over these.
 */

/** Exchange credentials for a device token and persist it. */
export async function signIn(email: string, password: string, deviceName: string): Promise<User> {
  const { token, user } = await api.createToken({
    email,
    password,
    device_name: deviceName,
  });
  await setToken(token);
  return user;
}

/**
 * Restore a session from a stored token on launch. Returns the user if the
 * token still authenticates; a token that no longer works (401) is dropped and
 * null is returned. Network/other errors bubble up so the caller can decide
 * (the token is kept — the user may just be offline).
 */
export async function restoreSession(): Promise<User | null> {
  const token = await getToken();
  if (!token) {
    return null;
  }

  try {
    const { user } = await api.me();
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearToken();
      return null;
    }
    throw error;
  }
}

/** Revoke the device token (best effort) and clear it locally. */
export async function signOut(): Promise<void> {
  try {
    await api.revokeCurrentToken();
  } catch {
    // Revoking may fail offline; the local token is cleared regardless.
  }
  await clearToken();
}

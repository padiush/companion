import { api, ApiError } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokens';
import type { User } from '../api/types';
import { clearSession, isWithinOfflineWindow, readSession, saveSession } from './session';

/**
 * The authentication logic, kept free of React so it can be unit-tested
 * directly. The AuthContext is a thin state wrapper over these.
 */

export interface RestoredSession {
  user: User;
  /** True when the identity came from the cache because the server was unreachable. */
  offline: boolean;
}

/** Exchange credentials for a device token and persist it. */
export async function signIn(email: string, password: string, deviceName: string): Promise<User> {
  const { token, user } = await api.createToken({
    email,
    password,
    device_name: deviceName,
  });
  await setToken(token);
  await saveSession(user);
  return user;
}

/**
 * Restore a session from a stored token on launch.
 *
 * The server is asked first, and a token it rejects (401) is dropped. When it
 * cannot be reached at all the cached identity is used instead, so a field
 * worker who force-quits with no signal still gets into their cached forms and
 * unsent drafts — previously any non-401 failure, including simply being
 * offline, dropped them at the sign-in screen with work stranded on the device.
 *
 * A cached identity is only good for OFFLINE_SESSION_MAX_AGE_DAYS; past that
 * the app asks for a real sign-in. Nothing local is deleted either way.
 */
export async function restoreSession(): Promise<RestoredSession | null> {
  const token = await getToken();
  if (!token) {
    return null;
  }

  try {
    const { user } = await api.me();
    await saveSession(user);
    return { user, offline: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearToken();
      await clearSession();
      return null;
    }

    // Unreachable — including a server error, which should not strand a field
    // worker any more than a lost signal does.
    const cached = await readSession();

    if (!cached || !isWithinOfflineWindow(cached)) {
      return null;
    }

    return { user: cached.user, offline: true };
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
  await clearSession();
}

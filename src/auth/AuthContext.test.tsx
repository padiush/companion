import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as accountStore from './accountStore';
import { AuthProvider, useAuth } from './AuthContext';
import * as authService from './authService';

jest.mock('./authService', () => ({
  restoreSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('./deviceName', () => ({ deviceName: () => 'Test Device' }));
jest.mock('./accountStore', () => {
  const actual = jest.requireActual('./accountStore');
  return {
    __esModule: true,
    SignInCancelled: actual.SignInCancelled,
    inspectStore: jest.fn(),
    claimStore: jest.fn(),
    replaceStore: jest.fn(),
    settleRestoredStore: jest.fn(),
  };
});

const mockRestore = authService.restoreSession as jest.Mock;
const mockSignIn = authService.signIn as jest.Mock;
const mockSignOut = authService.signOut as jest.Mock;
const mockInspectStore = accountStore.inspectStore as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const user = { id: 1, name: 'Field', email: 'field@example.org' };

beforeEach(() => {
  jest.clearAllMocks();
  mockInspectStore.mockResolvedValue({ action: 'keep' });
});

describe('AuthContext', () => {
  it('restores a signed-in session on launch', async () => {
    mockRestore.mockResolvedValue({ user, offline: false });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.user?.name).toBe('Field');
    expect(result.current.offline).toBe(false);
  });

  it('signs in offline on a cached identity and says so', async () => {
    mockRestore.mockResolvedValue({ user, offline: true });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.offline).toBe(true);
  });

  it('lands signed-out when there is no session', async () => {
    mockRestore.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.user).toBeNull();
  });

  it('lands signed-out when restoring itself fails', async () => {
    mockRestore.mockRejectedValue(new Error('secure store unavailable'));

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });

  it('clears the offline flag once a real sign-in succeeds', async () => {
    mockRestore.mockResolvedValue({ user, offline: true });
    mockSignIn.mockResolvedValue(user);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.offline).toBe(true));

    await act(async () => {
      await result.current.signIn('field@example.org', 'password');
    });

    expect(result.current.offline).toBe(false);
  });

  it('signIn transitions to signed-in with the device name', async () => {
    mockRestore.mockResolvedValue(null);
    mockSignIn.mockResolvedValue({ id: 2, name: 'Rec', email: 'rec@example.org' });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn('rec@example.org', 'password');
    });

    expect(mockSignIn).toHaveBeenCalledWith('rec@example.org', 'password', 'Test Device');
    expect(result.current.status).toBe('signedIn');
    expect(result.current.user?.name).toBe('Rec');
  });

  describe('the local store on sign-in', () => {
    const signIn = async (confirm?: jest.Mock) => {
      mockRestore.mockResolvedValue(null);
      mockSignIn.mockResolvedValue({ id: 2, name: 'Rec', email: 'rec@example.org' });

      const { result } = await renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.status).toBe('signedOut'));

      let thrown: unknown = null;
      await act(async () => {
        try {
          await result.current.signIn('rec@example.org', 'password', confirm);
        } catch (error) {
          thrown = error;
        }
      });

      return { result, thrown };
    };

    it('claims an unowned store', async () => {
      mockInspectStore.mockResolvedValue({ action: 'adopt' });

      const { result } = await signIn();

      expect(accountStore.claimStore).toHaveBeenCalledWith(2);
      expect(accountStore.replaceStore).not.toHaveBeenCalled();
      expect(result.current.status).toBe('signedIn');
    });

    it('replaces another account’s store without asking when nothing is pending', async () => {
      mockInspectStore.mockResolvedValue({
        action: 'replace',
        pending: { interviews: 0, media: 0 },
      });
      const confirm = jest.fn();

      const { result } = await signIn(confirm);

      expect(confirm).not.toHaveBeenCalled();
      expect(accountStore.replaceStore).toHaveBeenCalledWith(2);
      expect(result.current.status).toBe('signedIn');
    });

    it('asks before destroying another account’s unsent work', async () => {
      const pending = { interviews: 3, media: 1 };
      mockInspectStore.mockResolvedValue({ action: 'replace', pending });
      const confirm = jest.fn().mockResolvedValue(true);

      const { result } = await signIn(confirm);

      expect(confirm).toHaveBeenCalledWith(pending);
      expect(accountStore.replaceStore).toHaveBeenCalledWith(2);
      expect(result.current.status).toBe('signedIn');
    });

    it('abandons the sign-in when the user declines, leaving the store alone', async () => {
      mockInspectStore.mockResolvedValue({
        action: 'replace',
        pending: { interviews: 3, media: 0 },
      });
      mockSignOut.mockResolvedValue(undefined);

      const { result, thrown } = await signIn(jest.fn().mockResolvedValue(false));

      expect(thrown).toBeInstanceOf(accountStore.SignInCancelled);
      expect(accountStore.replaceStore).not.toHaveBeenCalled();
      // The token minted a moment ago is given back, not left live.
      expect(mockSignOut).toHaveBeenCalled();
      expect(result.current.status).toBe('signedOut');
    });

    /**
     * With no way to ask, silence must not read as permission — otherwise a
     * caller that forgot the prompt would quietly destroy field data.
     */
    it('treats a missing prompt as a refusal', async () => {
      mockInspectStore.mockResolvedValue({
        action: 'replace',
        pending: { interviews: 1, media: 0 },
      });
      mockSignOut.mockResolvedValue(undefined);

      const { thrown } = await signIn(undefined);

      expect(thrown).toBeInstanceOf(accountStore.SignInCancelled);
      expect(accountStore.replaceStore).not.toHaveBeenCalled();
    });
  });

  it('settles store ownership when a session is restored', async () => {
    mockRestore.mockResolvedValue({ user, offline: false });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    expect(accountStore.settleRestoredStore).toHaveBeenCalledWith(1);
  });

  it('signOut transitions back to signed-out', async () => {
    mockRestore.mockResolvedValue({ user, offline: false });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.user).toBeNull();
  });
});

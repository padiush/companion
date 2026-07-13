import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from './AuthContext';
import * as authService from './authService';

jest.mock('./authService', () => ({
  restoreSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('./deviceName', () => ({ deviceName: () => 'Test Device' }));

const mockRestore = authService.restoreSession as jest.Mock;
const mockSignIn = authService.signIn as jest.Mock;
const mockSignOut = authService.signOut as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const user = { id: 1, name: 'Field', email: 'field@example.org' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthContext', () => {
  it('restores a signed-in session on launch', async () => {
    mockRestore.mockResolvedValue(user);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.user?.name).toBe('Field');
  });

  it('lands signed-out when there is no session', async () => {
    mockRestore.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.user).toBeNull();
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

  it('signOut transitions back to signed-out', async () => {
    mockRestore.mockResolvedValue(user);
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

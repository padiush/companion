import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { User } from '../api/types';
import * as authService from './authService';
import { deviceName } from './deviceName';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Holds the session: restores a stored token on launch, and exposes sign-in /
 * sign-out. The actual work lives in authService; this just tracks status.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    authService
      .restoreSession()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus(restored ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        // Couldn't reach the server to validate the token — let the user sign in.
        if (active) setStatus('signedOut');
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      signIn: async (email, password) => {
        const signedIn = await authService.signIn(email, password, deviceName());
        setUser(signedIn);
        setStatus('signedIn');
      },
      signOut: async () => {
        await authService.signOut();
        setUser(null);
        setStatus('signedOut');
      },
    }),
    [status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

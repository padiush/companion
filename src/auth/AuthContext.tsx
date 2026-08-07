import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { User } from '../api/types';
import { hasPendingWork, type PendingWork } from '../db/ownership';
import {
  SignInCancelled,
  claimStore,
  inspectStore,
  replaceStore,
  settleRestoredStore,
} from './accountStore';
import * as authService from './authService';
import { deviceName } from './deviceName';

type Status = 'loading' | 'signedOut' | 'signedIn';

/**
 * Asked before another account's unsent work is destroyed. Resolving false
 * abandons the sign-in and leaves the store untouched.
 */
export type ConfirmReplace = (pending: PendingWork) => Promise<boolean>;

interface AuthState {
  status: Status;
  user: User | null;
  /** Signed in on a cached identity because the server could not be reached. */
  offline: boolean;
  signIn: (email: string, password: string, confirmReplace?: ConfirmReplace) => Promise<void>;
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
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    authService
      .restoreSession()
      .then(async (restored) => {
        // A restored session has no credentials on offer and nothing to
        // confirm, so ownership is settled without prompting.
        if (restored) {
          await settleRestoredStore(restored.user.id);
        }
        if (!active) return;
        setUser(restored?.user ?? null);
        setOffline(restored?.offline ?? false);
        setStatus(restored ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        // restoreSession already treats an unreachable server as offline, so
        // reaching here means local storage itself failed — sign in again.
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
      offline,
      signIn: async (email, password, confirmReplace) => {
        const signedIn = await authService.signIn(email, password, deviceName());
        const decision = await inspectStore(signedIn.id);

        if (decision.action === 'replace') {
          // Taking over another account's device destroys whatever it never
          // managed to send. Never do that silently: with no way to ask, treat
          // it as declined rather than as permission.
          if (hasPendingWork(decision.pending)) {
            const proceed = (await confirmReplace?.(decision.pending)) ?? false;

            if (!proceed) {
              await authService.signOut();
              throw new SignInCancelled();
            }
          }

          await replaceStore(signedIn.id);
        } else if (decision.action === 'adopt') {
          await claimStore(signedIn.id);
        }

        setUser(signedIn);
        setOffline(false);
        setStatus('signedIn');
      },
      signOut: async () => {
        await authService.signOut();
        setUser(null);
        setOffline(false);
        setStatus('signedOut');
      },
    }),
    [status, user, offline]
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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  applyThemePreference,
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from './themePreference';

interface ThemePreferenceState {
  preference: ThemePreference;
  /** Whether the stored choice has been read and applied. */
  ready: boolean;
  choose: (preference: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceState | null>(null);

/**
 * Reads the stored theme once at launch and applies it, then applies and
 * stores each new choice. Storage failing is not worth an error on screen:
 * the app then follows the device, and a choice holds until the next launch.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readThemePreference()
      .catch((): ThemePreference => 'system')
      .then((stored) => {
        applyThemePreference(stored);
        setPreference(stored);
        setReady(true);
      });
  }, []);

  const choose = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    setPreference(next);
    writeThemePreference(next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ preference, ready, choose }), [preference, ready, choose]);

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

const standalone: ThemePreferenceState = {
  preference: 'system',
  ready: true,
  choose: applyThemePreference,
};

/**
 * The theme chosen on this device and a way to change it. Outside a
 * provider (a screen rendered on its own, in a test) the device's theme
 * applies and a choice is not stored.
 */
export function useThemePreference(): ThemePreferenceState {
  return useContext(ThemePreferenceContext) ?? standalone;
}

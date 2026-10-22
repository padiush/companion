import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

/** How the app looks: always light, always dark, or as the device is set. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Kept on the device rather than with the account, as on the web: it is
 * about this screen, and it applies before anyone has signed in.
 */
const KEY = 'padiush.theme';

/** The stored choice; following the device when there is none, or it is unreadable. */
export async function readThemePreference(): Promise<ThemePreference> {
  const stored = await SecureStore.getItemAsync(KEY);
  return THEME_PREFERENCES.includes(stored as ThemePreference)
    ? (stored as ThemePreference)
    : 'system';
}

export async function writeThemePreference(preference: ThemePreference): Promise<void> {
  await SecureStore.setItemAsync(KEY, preference);
}

/**
 * Overrides the colour scheme for the whole app, natively, so every screen
 * (through `useColorScheme`) and the system's own dialogs, pickers and status
 * bar follow it. 'unspecified' hands it back to the device.
 */
export function applyThemePreference(preference: ThemePreference): void {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

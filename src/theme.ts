import { useColorScheme } from 'react-native';

/**
 * The Padiush brand palette, ported from the web app's daisyUI themes
 * (`padiushlight`/`padiushdark`) — the oklch values converted to hex. Roles map
 * to daisyUI tokens: bg = base-200, card = base-100, border = base-300,
 * text = base-content, primary/onPrimary = primary/primary-content, danger = error.
 */
const light = {
  bg: '#e4e4e4',
  card: '#f5f5f5',
  border: '#d4d4d4',
  text: '#0b0908',
  muted: '#6f7268',
  primary: '#3c6200',
  onPrimary: '#f5fce5',
  danger: '#ea003e',
  inputBg: '#ffffff',
};

const dark = {
  bg: '#131712',
  card: '#1a1e19',
  border: '#2a2f28',
  text: '#dbe5d8',
  muted: '#97a091',
  primary: '#6c9543',
  onPrimary: '#071001',
  danger: '#fb5669',
  inputBg: '#30342e',
};

export type Theme = typeof light;

/** The active palette, following the device's light/dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

import { useColorScheme } from 'react-native';

const light = {
  bg: '#f7f7f5',
  card: '#ffffff',
  border: '#e3e3df',
  text: '#1b1b18',
  muted: '#6b6b64',
  primary: '#2f7d4f',
  onPrimary: '#ffffff',
  danger: '#b3261e',
  inputBg: '#ffffff',
};

const dark = {
  bg: '#16161a',
  card: '#1f1f24',
  border: '#2c2c33',
  text: '#f2f2ef',
  muted: '#9a9a92',
  primary: '#4ba572',
  onPrimary: '#0d0d0f',
  danger: '#f2b8b5',
  inputBg: '#26262c',
};

export type Theme = typeof light;

/** The active palette, following the device's light/dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

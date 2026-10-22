import { Appearance } from 'react-native';

import { applyThemePreference, readThemePreference, writeThemePreference } from './themePreference';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

beforeEach(() => mockStore.clear());

describe('the theme chosen on this device', () => {
  it('follows the device until something is chosen', async () => {
    await expect(readThemePreference()).resolves.toBe('system');
  });

  it('is remembered once chosen', async () => {
    await writeThemePreference('dark');

    await expect(readThemePreference()).resolves.toBe('dark');
  });

  it('follows the device when what is stored is not a theme', async () => {
    mockStore.set('padiush.theme', 'sepia');

    await expect(readThemePreference()).resolves.toBe('system');
  });
});

describe('applyThemePreference', () => {
  it('sets the scheme for the whole app, and hands it back to the device for system', () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

    applyThemePreference('light');
    applyThemePreference('dark');
    applyThemePreference('system');

    expect(setColorScheme.mock.calls).toEqual([['light'], ['dark'], ['unspecified']]);
    setColorScheme.mockRestore();
  });
});

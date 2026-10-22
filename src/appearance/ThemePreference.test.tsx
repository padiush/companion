import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ThemePreferenceProvider, useThemePreference } from './ThemePreference';
import { applyThemePreference, readThemePreference, writeThemePreference } from './themePreference';

jest.mock('./themePreference', () => ({
  readThemePreference: jest.fn(),
  writeThemePreference: jest.fn(async () => undefined),
  applyThemePreference: jest.fn(),
}));

const mockRead = readThemePreference as jest.Mock;
const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemePreferenceProvider>{children}</ThemePreferenceProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue('system');
});

describe('ThemePreferenceProvider', () => {
  it('applies the stored theme before saying it is ready', async () => {
    let answer: (value: string) => void = () => undefined;
    mockRead.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = await renderHook(() => useThemePreference(), { wrapper });
    expect(result.current.ready).toBe(false);

    await act(async () => answer('dark'));

    expect(result.current).toMatchObject({ preference: 'dark', ready: true });
    expect(applyThemePreference).toHaveBeenCalledWith('dark');
  });

  it('applies and remembers a new choice at once', async () => {
    const { result } = await renderHook(() => useThemePreference(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.choose('light'));

    expect(result.current.preference).toBe('light');
    expect(applyThemePreference).toHaveBeenLastCalledWith('light');
    expect(writeThemePreference).toHaveBeenCalledWith('light');
  });

  /** A storage failure is not worth an error on screen. */
  it('follows the device when the stored theme cannot be read', async () => {
    mockRead.mockRejectedValue(new Error('keystore'));
    const { result } = await renderHook(() => useThemePreference(), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preference).toBe('system');
    expect(applyThemePreference).toHaveBeenCalledWith('system');
  });
});

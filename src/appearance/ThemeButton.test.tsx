import { fireEvent, render } from '@testing-library/react-native';

import { ThemeButton } from './ThemeButton';
import { useThemePreference } from './ThemePreference';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { mode?: string }) => (opts?.mode ? `${key}:${opts.mode}` : key),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('./ThemePreference', () => ({ useThemePreference: jest.fn() }));
const mockHold = jest.fn();
jest.mock('../tips/TipsContext', () => ({
  useTipsHold: (held: boolean) => mockHold(held),
}));

const mockChoose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useThemePreference as jest.Mock).mockReturnValue({
    preference: 'system',
    ready: true,
    choose: mockChoose,
  });
});

describe('ThemeButton', () => {
  it('says which theme is in use', async () => {
    const { getByTestId } = await render(<ThemeButton color="#fff" />);

    expect(getByTestId('theme').props.accessibilityLabel).toBe('theme.button:theme.system');
  });

  it('offers light, dark and the device, with the current one chosen', async () => {
    const { getByTestId } = await render(<ThemeButton color="#fff" />);

    await fireEvent.press(getByTestId('theme'));

    for (const option of ['light', 'dark', 'system']) {
      expect(getByTestId(`theme-${option}`).props.accessibilityState).toEqual({
        selected: option === 'system',
      });
    }
  });

  it('applies a choice and closes', async () => {
    const { getByTestId, queryByTestId } = await render(<ThemeButton color="#fff" />);
    await fireEvent.press(getByTestId('theme'));

    await fireEvent.press(getByTestId('theme-dark'));

    expect(mockChoose).toHaveBeenCalledWith('dark');
    expect(queryByTestId('theme-dark')).toBeNull();
  });

  it('holds the tips back while the choice is open', async () => {
    const { getByTestId } = await render(<ThemeButton color="#fff" />);
    expect(mockHold).toHaveBeenLastCalledWith(false);

    await fireEvent.press(getByTestId('theme'));

    expect(mockHold).toHaveBeenLastCalledWith(true);
  });
});

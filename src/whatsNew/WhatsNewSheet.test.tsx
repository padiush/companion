import { fireEvent, render } from '@testing-library/react-native';

import { WhatsNewSheet } from './WhatsNewSheet';

let mockReleases: unknown = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'whatsNew.releases' ? mockReleases : key),
    i18n: { language: 'es' },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.0' } },
}));

const RELEASES = [
  { version: '1.2.0', date: null, items: ['Not shipped yet'] },
  { version: '1.1.0', date: '2026-10-10', items: ['Three tabs', 'Field records'] },
  { version: '1.0.0', date: '2026-08-15', items: ['First release'] },
];

beforeEach(() => {
  mockReleases = RELEASES;
});

describe('WhatsNewSheet', () => {
  it('shows what shipped since the last release seen', async () => {
    const screen = await render(<WhatsNewSheet since="1.0.0" onDismiss={jest.fn()} />);

    expect(screen.getByText('Three tabs')).toBeTruthy();
    expect(screen.getByText('Field records')).toBeTruthy();
    expect(screen.queryByText('First release')).toBeNull();
    expect(screen.queryByText('Not shipped yet')).toBeNull();
  });

  it('is dismissed with its button', async () => {
    const onDismiss = jest.fn();
    const screen = await render(<WhatsNewSheet since="1.0.0" onDismiss={onDismiss} />);

    await fireEvent.press(screen.getByTestId('whats-new-dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('marks a release without notes seen, showing nothing', async () => {
    mockReleases = [RELEASES[2]];
    const onDismiss = jest.fn();

    const screen = await render(<WhatsNewSheet since="1.0.0" onDismiss={onDismiss} />);

    expect(screen.queryByTestId('whats-new')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

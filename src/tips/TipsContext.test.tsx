import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Dimensions, Text, View } from 'react-native';

import { HOLE_PADDING, type Rect } from './placement';
import { whilePrompting } from './systemPrompts';
import {
  TipAnchor,
  TipsProvider,
  useReplayTips,
  useTipsHold,
  useTour,
  type Measure,
} from './TipsContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.current ? `${key}:${opts.current}/${opts.total}` : key,
    i18n: { language: 'es' },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const SEEN = 'padiush.tips.seen.7';

/** Where each control is on screen; null is a control that cannot be measured. */
let rects: Record<string, Rect | null>;

const measure: Measure = async (view) => {
  const id = String((view as unknown as { props: { testID: string } }).props.testID);
  return rects[id.replace('tip-anchor-', '')] ?? null;
};

/** A stand-in for the Entrevistas screen: its three controls and its tour. */
function Home({ ready = true, sheetOpen = false }: { ready?: boolean; sheetOpen?: boolean }) {
  useTour('home', ready);
  useTipsHold(sheetOpen);
  const replay = useReplayTips();

  return (
    <View>
      <TipAnchor id="home.newInterview">
        <Text>Nueva entrevista</Text>
      </TipAnchor>
      <TipAnchor id="home.newRecord">
        <Text>Nuevo registro</Text>
      </TipAnchor>
      <TipAnchor id="home.sync">
        <Text>Sincronizado</Text>
      </TipAnchor>
      <Text onPress={() => void replay()}>replay</Text>
    </View>
  );
}

const renderHome = (props: { held?: boolean; ready?: boolean; sheetOpen?: boolean } = {}) =>
  render(
    <TipsProvider userId={7} held={props.held ?? false} measure={measure}>
      <Home ready={props.ready} sheetOpen={props.sheetOpen} />
    </TipsProvider>
  );

/** Waits for a tour to open, and lays it out as the device would. */
async function opened(screen: Awaited<ReturnType<typeof render>>) {
  await waitFor(() => expect(screen.getByTestId('tip')).toBeTruthy(), { timeout: 2000 });
  await fireEvent(screen.getByTestId('tip'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 860 } },
  });
}

/** Long enough for the screen to settle and the tour to start. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 700)));

beforeEach(() => {
  mockStore.clear();
  mockFocused = true;
  rects = {
    'home.newInterview': { x: 16, y: 200, width: 170, height: 100 },
    'home.newRecord': { x: 200, y: 200, width: 170, height: 100 },
    'home.sync': { x: 20, y: 150, width: 300, height: 24 },
  };
});

describe('the tips', () => {
  it("walk an account through a screen's controls the first time, then not again", async () => {
    const screen = await renderHome();

    await opened(screen);
    expect(screen.getByText('tips.home.newInterview.title')).toBeTruthy();
    expect(screen.getByText('tips.progress:1/3')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tip-next'));
    expect(screen.getByText('tips.home.newRecord.title')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tip-next'));
    expect(screen.getByText('tips.home.sync.title')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tip-next'));

    expect(screen.queryByTestId('tip')).toBeNull();
    await waitFor(() => expect(mockStore.get(SEEN)).toBe('["home"]'));
  });

  it('leave out a step whose control is not on screen', async () => {
    rects['home.newRecord'] = { x: 200, y: 5000, width: 170, height: 100 };
    rects['home.sync'] = null;
    const screen = await renderHome();

    await opened(screen);
    expect(screen.getByText('tips.home.newInterview.title')).toBeTruthy();
    expect(screen.getByText('tips.done')).toBeTruthy();
    expect(screen.queryByText(/tips\.progress/)).toBeNull();
  });

  it('do not run a tour the account has already seen', async () => {
    mockStore.set(SEEN, '["home"]');
    const screen = await renderHome();

    await settle();
    expect(screen.queryByTestId('tip')).toBeNull();
  });

  it('count a skipped tour as seen', async () => {
    const screen = await renderHome();
    await opened(screen);

    await fireEvent.press(screen.getByTestId('tip-skip'));

    expect(screen.queryByTestId('tip')).toBeNull();
    await waitFor(() => expect(mockStore.get(SEEN)).toBe('["home"]'));
  });

  it('wait for whatever is open over the screens, then run', async () => {
    const screen = await renderHome({ held: true });
    await settle();
    expect(screen.queryByTestId('tip')).toBeNull();

    await screen.rerender(
      <TipsProvider userId={7} held={false} measure={measure}>
        <Home />
      </TipsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('tip')).toBeTruthy(), { timeout: 2000 });
  });

  it("wait for a sheet of the screen's own", async () => {
    const screen = await renderHome({ sheetOpen: true });
    await settle();
    expect(screen.queryByTestId('tip')).toBeNull();
  });

  it('wait for a screen that is not ready, or not in front', async () => {
    const notReady = await renderHome({ ready: false });
    await settle();
    expect(notReady.queryByTestId('tip')).toBeNull();
    await notReady.unmount();

    mockFocused = false;
    const behind = await renderHome();
    await settle();
    expect(behind.queryByTestId('tip')).toBeNull();
  });

  it('wait for a system prompt to be answered', async () => {
    let answer: () => void = () => undefined;
    const prompt = whilePrompting(() => new Promise<void>((resolve) => (answer = resolve)));
    const screen = await renderHome();

    await settle();
    expect(screen.queryByTestId('tip')).toBeNull();

    await act(async () => {
      answer();
      await prompt;
    });
    await waitFor(() => expect(screen.getByTestId('tip')).toBeTruthy(), { timeout: 2000 });
  });

  it('follow their control when the screen turns or unfolds', async () => {
    const portrait = Dimensions.get('window');
    const screen = await renderHome();
    await opened(screen);
    await fireEvent.press(screen.getByTestId('tip-next'));
    const ringLeft = () =>
      Object.assign({}, ...[screen.getByTestId('tip-ring').props.style].flat(Infinity)).left;
    expect(ringLeft()).toBe(200 - HOLE_PADDING);

    rects['home.newRecord'] = { x: 500, y: 120, width: 170, height: 100 };
    await act(async () => {
      Dimensions.set({
        window: { ...portrait, width: portrait.height, height: portrait.width },
        screen: { ...portrait, width: portrait.height, height: portrait.width },
      });
    });

    // Still on the second step, now highlighting the control where it moved to.
    await waitFor(() => expect(ringLeft()).toBe(500 - HOLE_PADDING), { timeout: 2000 });
    expect(screen.getByText('tips.progress:2/3')).toBeTruthy();

    await act(async () => {
      Dimensions.set({ window: portrait, screen: portrait });
    });
  });

  it('run again when asked to', async () => {
    mockStore.set(SEEN, '["home","outbox"]');
    const screen = await renderHome();
    await settle();
    expect(screen.queryByTestId('tip')).toBeNull();

    await fireEvent.press(screen.getByText('replay'));

    await waitFor(() => expect(screen.getByTestId('tip')).toBeTruthy(), { timeout: 2000 });
    expect(mockStore.has(SEEN)).toBe(false);
  });
});

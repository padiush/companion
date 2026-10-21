import { fireEvent, render } from '@testing-library/react-native';

import { TipOverlay, type TipStep } from './TipOverlay';

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

const steps: TipStep[] = [
  { key: 'newInterview', hole: { x: 10, y: 180, width: 180, height: 110 } },
  { key: 'newRecord', hole: { x: 200, y: 180, width: 180, height: 110 } },
  { key: 'sync', hole: { x: 20, y: 120, width: 300, height: 30 } },
];

/** Lays the overlay and its card out, as the device would. */
async function laidOut(screen: Awaited<ReturnType<typeof render>>, key: string) {
  await fireEvent(screen.getByTestId('tip'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 860 } },
  });
  await fireEvent(screen.getByTestId(`tip-home-${key}`), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 368, height: 190 } },
  });
}

describe('TipOverlay', () => {
  it("names the step's control, and how far through the tour it is", async () => {
    const screen = await render(
      <TipOverlay tour="home" steps={steps} index={0} onNext={jest.fn()} onSkip={jest.fn()} />
    );
    await laidOut(screen, 'newInterview');

    expect(screen.getByText('tips.home.newInterview.title')).toBeTruthy();
    expect(screen.getByText('tips.home.newInterview.body')).toBeTruthy();
    expect(screen.getByText('tips.progress:1/3')).toBeTruthy();
    expect(screen.getByText('tips.next')).toBeTruthy();
  });

  it('places the card beside the control once it is measured', async () => {
    const screen = await render(
      <TipOverlay tour="home" steps={steps} index={0} onNext={jest.fn()} onSkip={jest.fn()} />
    );
    await laidOut(screen, 'newInterview');

    const card = screen.getByTestId('tip-home-newInterview');
    const style = Object.assign({}, ...[card.props.style].flat(Infinity).filter(Boolean));
    expect(style.top).toBeGreaterThan(180 + 110);
    expect(style.opacity).toBeUndefined();
  });

  it('moves on with Next, and lets the whole tour be skipped', async () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();
    const screen = await render(
      <TipOverlay tour="home" steps={steps} index={0} onNext={onNext} onSkip={onSkip} />
    );
    await laidOut(screen, 'newInterview');

    await fireEvent.press(screen.getByTestId('tip-next'));
    expect(onNext).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('tip-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('ends on Got it, with nothing left to skip', async () => {
    const screen = await render(
      <TipOverlay tour="home" steps={steps} index={2} onNext={jest.fn()} onSkip={jest.fn()} />
    );
    await laidOut(screen, 'sync');

    expect(screen.getByText('tips.done')).toBeTruthy();
    expect(screen.queryByTestId('tip-skip')).toBeNull();
  });

  it('shows no count for a tour of one step', async () => {
    const screen = await render(
      <TipOverlay tour="home" steps={[steps[0]]} index={0} onNext={jest.fn()} onSkip={jest.fn()} />
    );
    await laidOut(screen, 'newInterview');

    expect(screen.queryByText(/tips\.progress/)).toBeNull();
    expect(screen.getByText('tips.done')).toBeTruthy();
  });
});

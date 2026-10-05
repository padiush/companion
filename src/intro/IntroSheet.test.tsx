import { fireEvent, render } from '@testing-library/react-native';

import { IntroSheet } from './IntroSheet';
import { INTRO_STEPS } from './steps';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { current?: number; total?: number }) =>
      opts?.current ? `${key}:${opts.current}/${opts.total}` : key,
    i18n: { language: 'es' },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('IntroSheet', () => {
  it('walks through every step, then starts the app', async () => {
    const onDone = jest.fn();
    const screen = await render(<IntroSheet visible onDone={onDone} />);

    for (const [index, step] of INTRO_STEPS.entries()) {
      expect(screen.getByText(`intro.${step.key}.title`)).toBeTruthy();
      expect(screen.getByText(`intro.${step.key}.body`)).toBeTruthy();
      expect(screen.getByTestId('intro-progress').props.accessibilityLabel).toBe(
        `intro.progress:${index + 1}/${INTRO_STEPS.length}`
      );
      if (index < INTRO_STEPS.length - 1) {
        await fireEvent.press(screen.getByTestId('intro-next'));
      }
    }

    expect(screen.getByText('intro.start')).toBeTruthy();
    expect(screen.queryByTestId('intro-skip')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('intro-next'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be skipped from any step', async () => {
    const onDone = jest.fn();
    const screen = await render(<IntroSheet visible onDone={onDone} />);

    await fireEvent.press(screen.getByTestId('intro-next'));
    await fireEvent.press(screen.getByTestId('intro-skip'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts from the beginning when opened again', async () => {
    const screen = await render(<IntroSheet visible onDone={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('intro-next'));
    expect(screen.getByText(`intro.${INTRO_STEPS[1].key}.title`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('intro-skip'));
    await screen.rerender(<IntroSheet visible={false} onDone={jest.fn()} />);
    await screen.rerender(<IntroSheet visible onDone={jest.fn()} />);

    expect(screen.getByText(`intro.${INTRO_STEPS[0].key}.title`)).toBeTruthy();
  });
});

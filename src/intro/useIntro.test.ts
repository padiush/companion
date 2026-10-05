import { act, renderHook, waitFor } from '@testing-library/react-native';

import { hasSeenIntro, markIntroSeen } from './introSeen';
import { useIntro } from './useIntro';

jest.mock('./introSeen', () => ({
  hasSeenIntro: jest.fn(),
  markIntroSeen: jest.fn(async () => undefined),
}));

const mockSeen = hasSeenIntro as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSeen.mockResolvedValue(false);
});

describe('useIntro', () => {
  it('opens for an account that has not seen it', async () => {
    const { result } = await renderHook(() => useIntro(7, false));

    await waitFor(() => expect(result.current.open).toBe(true));
    expect(mockSeen).toHaveBeenCalledWith(7);
  });

  it('stays closed for an account that has', async () => {
    mockSeen.mockResolvedValue(true);
    const { result } = await renderHook(() => useIntro(7, false));

    await waitFor(() => expect(mockSeen).toHaveBeenCalled());
    expect(result.current.open).toBe(false);
  });

  it('waits for nobody signed in, and for the release notes', async () => {
    const { result, rerender } = await renderHook(
      ({ userId, waiting }: { userId: number | null; waiting: boolean }) =>
        useIntro(userId, waiting),
      { initialProps: { userId: null as number | null, waiting: true } }
    );

    await rerender({ userId: 7, waiting: true });
    expect(mockSeen).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);

    await rerender({ userId: 7, waiting: false });
    await waitFor(() => expect(result.current.open).toBe(true));
  });

  it('counts closing it, finished or skipped, as seen', async () => {
    const { result } = await renderHook(() => useIntro(7, false));
    await waitFor(() => expect(result.current.open).toBe(true));

    await act(async () => result.current.finish());

    expect(result.current.open).toBe(false);
    expect(markIntroSeen).toHaveBeenCalledWith(7);
  });

  /** A storage failure is not worth an error on screen. */
  it('shows nothing when it cannot tell', async () => {
    mockSeen.mockRejectedValue(new Error('keystore'));
    const { result } = await renderHook(() => useIntro(7, false));

    await waitFor(() => expect(mockSeen).toHaveBeenCalled());
    expect(result.current.open).toBe(false);
  });
});

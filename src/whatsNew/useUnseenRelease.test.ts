import { renderHook, waitFor } from '@testing-library/react-native';

import { resolveUnseenSince } from './seenVersion';
import { useUnseenRelease } from './useUnseenRelease';

jest.mock('./seenVersion', () => ({
  resolveUnseenSince: jest.fn(),
  writeSeenVersion: jest.fn(async () => undefined),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.0' } },
}));

const mockResolve = resolveUnseenSince as jest.Mock;

beforeEach(() => jest.clearAllMocks());

/**
 * What waits for the release notes (the walkthrough) waits on `decided`, so it
 * must come true however the question is answered.
 */
describe('useUnseenRelease', () => {
  it('is undecided while the session is still loading', async () => {
    const { result } = await renderHook(() => useUnseenRelease('loading'));

    expect(result.current.decided).toBe(false);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('decides, with notes to show', async () => {
    mockResolve.mockResolvedValue('1.0.0');
    const { result } = await renderHook(() => useUnseenRelease('signedIn'));

    await waitFor(() => expect(result.current.decided).toBe(true));
    expect(result.current.since).toBe('1.0.0');
  });

  it('decides even when storage fails', async () => {
    mockResolve.mockRejectedValue(new Error('keystore'));
    const { result } = await renderHook(() => useUnseenRelease('signedIn'));

    await waitFor(() => expect(result.current.decided).toBe(true));
    expect(result.current.since).toBeNull();
  });
});

import { renderHook } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { useOnline } from './useOnline';

jest.mock('expo-network', () => ({ useNetworkState: jest.fn() }));

const mockState = useNetworkState as jest.Mock;

describe('useOnline', () => {
  it('is offline when the system says there is no connection', async () => {
    mockState.mockReturnValue({ isConnected: false });
    expect((await renderHook(() => useOnline())).result.current).toBe(false);
  });

  it('is offline when connected but the internet cannot be reached', async () => {
    mockState.mockReturnValue({ isConnected: true, isInternetReachable: false });
    expect((await renderHook(() => useOnline())).result.current).toBe(false);
  });

  /** A state not reported yet must not raise a warning that is not true. */
  it('assumes online until the system says otherwise', async () => {
    mockState.mockReturnValue({});
    expect((await renderHook(() => useOnline())).result.current).toBe(true);
  });
});

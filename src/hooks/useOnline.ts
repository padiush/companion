import { useNetworkState } from 'expo-network';

/**
 * Whether the device can reach the internet right now, as the system reports
 * it: false only when it is known to be offline, so a state not yet reported
 * never shows a warning that is not true.
 */
export function useOnline(): boolean {
  const state = useNetworkState();

  if (state.isConnected === false || state.isInternetReachable === false) {
    return false;
  }
  return true;
}

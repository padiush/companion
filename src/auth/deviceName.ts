import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * A human-readable name for the device token, so a user can recognise and
 * revoke a specific lost device from the web.
 */
export function deviceName(): string {
  return Device.deviceName ?? Device.modelName ?? `Padiush (${Platform.OS})`;
}

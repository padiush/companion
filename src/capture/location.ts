import * as Location from 'expo-location';

import type { DraftLocation } from '../db/instancesRepository';
import { whilePrompting } from '../tips/systemPrompts';

/**
 * Best-effort GPS fix for a new interview. Returns null if permission is denied
 * or the fix fails — location is optional and must never block capture.
 */
export async function captureLocation(): Promise<DraftLocation | null> {
  try {
    // The first time, this is a system prompt over the screen just opened;
    // the tips wait for it to be answered.
    const { status } = await whilePrompting(() => Location.requestForegroundPermissionsAsync());
    if (status !== 'granted') {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      capturedAt: new Date(position.timestamp).toISOString(),
    };
  } catch {
    return null;
  }
}

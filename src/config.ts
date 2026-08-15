/**
 * App configuration. The API base URL points at the Padiush platform's
 * versioned capture API (`/api/v1`). Override it per environment with the
 * EXPO_PUBLIC_API_BASE_URL env var (Expo inlines EXPO_PUBLIC_* at build time);
 * the default is the local dev server.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

/**
 * Where the source of this build lives. The app is released under the AGPL, so
 * the licence travels with the binary and whoever receives it is entitled to
 * the source of the version they are running. If you fork the app and publish
 * your own build, point this at your source rather than ours.
 */
export const SOURCE_URL =
  process.env.EXPO_PUBLIC_SOURCE_URL ?? 'https://github.com/padiush/companion';

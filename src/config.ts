/**
 * App configuration. The API base URL points at the Padiush platform's
 * versioned capture API (`/api/v1`). Override it per environment with the
 * EXPO_PUBLIC_API_BASE_URL env var (Expo inlines EXPO_PUBLIC_* at build time);
 * the default is the local dev server.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

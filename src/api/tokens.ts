import * as SecureStore from 'expo-secure-store';

/**
 * The device's Sanctum bearer token, held in the platform secure store
 * (Keychain / Keystore). The password is never stored — only this token.
 */
const TOKEN_KEY = 'padiush.capture_token';

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

import * as Crypto from 'expo-crypto';

/**
 * A client-generated UUID. Offline capture mints these on-device for instances
 * and answers; they are the idempotency keys the sync endpoint upserts on
 * (see the platform's sync-protocol contract).
 */
export function uuid(): string {
  return Crypto.randomUUID();
}

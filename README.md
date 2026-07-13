# Padiush Companion

The mobile field-capture app for the [Padiush](https://padiushbio.test)
ethnobotanical research platform. Built with **Expo / React Native** and
TypeScript.

## Scope — capture only

This app records interviews in the field, **fully offline**, and syncs when
connectivity allows: interviews, answers, GPS, audio, and photos. Form design,
species linking, analysis, and export stay on the web platform and are out of
scope here. It builds against the platform's versioned capture API (`/api/v1`) —
the authoritative contract is that repo's `docs/api/openapi.yaml`.

## Stack

- Expo SDK 57, React 19, React Native 0.86, TypeScript
- `expo-secure-store` — the bearer token, in Keychain / Keystore (never the password)
- `expo-sqlite` (SQLCipher) — the offline local store for captured records,
  encrypted at rest with a device-generated key held in the secure store
- `expo-location` — GPS for interview location
- `expo-audio` — interview audio recording
- `expo-file-system` — reading captures for ingest into the encrypted store
- `expo-crypto` — client-generated UUIDs (the sync idempotency keys)

## Getting started

```bash
npm install
npm start          # Expo dev server; press i / a / w for iOS / Android / web
```

Point the app at a backend by setting the API base URL (defaults to the local
dev server):

```bash
cp .env.example .env
# edit EXPO_PUBLIC_API_BASE_URL
```

## Project structure

```
App.tsx            Landing screen (placeholder until capture screens land)
src/
  config.ts        API base URL (EXPO_PUBLIC_API_BASE_URL)
  ids.ts           Client-generated UUIDs for offline records
  api/
    types.ts       Types mirroring the /api/v1 contract
    tokens.ts      Secure token storage
    client.ts      Typed API client (auth, pull, sync, media)
```

## How sync works (summary)

The device is the sole author of its captures until they land on the server, so
sync is push-dominant:

1. **Auth** — exchange credentials for a device token (stored securely).
2. **Pull** — cache each active form's structure (`GET /me`, `/projects/{p}/bundle`).
3. **Capture** — record interviews offline into SQLite; each instance and answer
   gets a client UUID at creation.
4. **Push** — `POST /projects/{p}/instances:sync`, an idempotent batch upsert;
   retries are safe.
5. **Media** — audio/photos are ingested into the encrypted store at capture
   (the plaintext original is deleted), then uploaded via presigned URLs out of
   band and cleared from the device once stored server-side.

Conflicts on the same answer resolve by last-writer-wins on the device edit-time.
The local store is encrypted at rest with SQLCipher (it holds informant responses
until synced); the key is minted on-device and lives in Keychain / Keystore.

# Padiush Companion

The mobile field-capture app for [Padiush](https://padiushbio.com), the
ethnobotanical research platform ([source](https://github.com/padiush/platform)).
Built with **Expo / React Native** and TypeScript.

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
- `expo-audio` — interview audio recording, continuing while the app is
  backgrounded (a recording foreground service on Android, the `audio`
  background mode on iOS)
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
App.tsx            Session gate: sign-in, or the signed-in tab navigator
src/
  config.ts        API base URL (EXPO_PUBLIC_API_BASE_URL)
  ids.ts           Client-generated UUIDs for offline records
  api/             Typed /api/v1 client, secure token storage, contract types
  auth/            Session, cached identity for offline launch, store ownership
  db/              Encrypted SQLite store: schema migrations and repositories
  capture/         The interview itself: inputs, media, validation, draft state
  sync/            Pull, push, media upload, and resolving what the server refused
  screens/         Projects, one project, an interview, recorded interviews
  navigation/      Root stack and the signed-in bottom tabs
  i18n/            es / en / pt, Spanish first
```

Everything user-facing is localized in all three languages; the local store is
versioned by `PRAGMA user_version` (`src/db/schema.ts`), so schema changes reach
devices that already hold data.

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

A push is not all-or-nothing. The server can accept an interview while refusing
individual answers — an item deleted on the web is the usual cause — so such an
interview is marked incomplete rather than sent, the reason is kept against the
answer, and the interview screen offers to correct it, discard that one answer,
or try again. Nothing the server refuses is dropped silently.

## Working offline

- **Launch** uses the cached identity when the server cannot be reached, so a
  force-quit off-grid does not lock a recorder out of their unsent work. It is
  good for 30 days, refreshed whenever the server confirms the account.
- **One account at a time.** The store records who it belongs to; a different
  account signing in replaces it, after saying exactly what unsent work that
  destroys. Signing out keeps the data, so the same person can come back.
- **Retired forms** stop being offered as soon as a pull says they are no longer
  active, but a form an existing interview still needs is kept so that interview
  can still be rendered and sent.
- **Recording survives the phone going away** — locked, pocketed, or left on
  another app — because an interview outlasts the screen timeout. It can still
  be ended by something outside the app: the notification's stop button, an
  incoming call taking audio focus, or Android reclaiming the service. Coming
  back to a frozen clock that still claims to be recording is the one outcome
  worth engineering against, so on return the app believes the recorder over
  its own state, keeps whatever reached disk, and says the take was cut short.

## Releases

Builds go through EAS ([eas.json](eas.json)). `development` serves JS from your
Metro server and so honours your local `.env`; `preview` and `production` bake
in the production API URL, so a release never ships whatever a developer left
in `.env`.

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile closed-testing
```

`android.versionCode` in [app.json](app.json) is the record of what shipped —
the production profile increments it, so commit the bump.

## Testing

```bash
npm test           # jest — repository SQL runs against a real engine (node:sqlite)
npm run typecheck
npm run lint
```

The DB layer cannot load expo-sqlite under jest, so `test-utils/sqliteDatabase.ts`
puts Node's built-in SQLite behind the same interface. SQLCipher is not part of
it, so the encryption path is covered by its own mocked tests and on-device runs.

## Provenance

Padiush began as a system written for a single ethnobotanical thesis. It was
rebuilt as a general tool once it was clear the same instrument served studies
beyond that one, and this app was written for that second version. The design
of the offline store, the sync model and the capture workflow are recorded in
the platform repository's [architecture decisions](https://github.com/padiush/platform/tree/master/docs/decisions).
Development since 2026 has been AI-assisted; the architecture and the decisions
behind it are not.

## Licence

Copyright © Mercedes Menéndez and Rodrigo Arévalo.

Released under the **GNU Affero General Public License v3.0 or later** — see
[LICENSE](LICENSE). In short: you may use, study, modify and redistribute this
app, including running your own instance against your own Padiush server, so
long as those you distribute it to receive the same freedoms and the source of
your changes.

This is research software, published so that researchers can verify how
captured data is stored and transmitted rather than take our word for it. It
comes with **no support commitment** — see [CONTRIBUTING.md](CONTRIBUTING.md),
which also covers the sign-off required on contributions.

If you use it in published research, please cite it — see [CITATION.cff](CITATION.cff).

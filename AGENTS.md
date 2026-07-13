# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Padiush Companion — project notes

- **What this is:** the capture-only mobile app for the Padiush ethnobotany
  platform (Expo / React Native + TypeScript). Records interviews offline and
  syncs to the platform's `/api/v1`. Form design, species linking, analysis and
  export live on the web, not here.
- **The API contract is authoritative.** Endpoints, shapes and error envelopes
  are defined by the platform's `docs/api/openapi.yaml`. The typed client lives
  in `src/api` — keep `src/api/types.ts` in step with the spec.
- **Offline-first / push-dominant sync.** The device authors its captures and owns
  them until synced. Instances and answers get client-generated UUIDs (`src/ids.ts`)
  that are the sync idempotency keys. Conflicts resolve last-writer-wins on the
  device edit-time.
- **Security:** the bearer token goes in secure storage (`src/api/tokens.ts`), never
  the password. The local capture store must be encrypted at rest — it holds
  informant responses until synced.
- **Conventions:** TypeScript strict; commits are conventional (`type: subject`,
  no scope), matching the platform repo. Features and fixes ship with tests
  (`npm test` — jest-expo + React Native Testing Library) and pass `npm run lint`
  and `npm run typecheck`. Every user-facing string is localized in `src/i18n`
  (es/en/pt, Spanish first) — never hard-code display text.
- **Verification:** Jest + `npm run typecheck` + `npx expo-doctor`. The platform's
  in-browser breakpoint check does **not** apply here — this is a native app, not
  a web UI. Smoke-test on a device/simulator when one is available.

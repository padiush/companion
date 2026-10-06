# Changelog

Notable changes to the Padiush companion app, one section per release. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/).

This is the record for people who build or distribute the app. Researchers read
the same releases as "What's new" inside the app, written for them and in their
language (`whatsNew.releases` in `src/i18n/locales/`). How a release is cut is
in [docs/releasing.md](docs/releasing.md).

## [Unreleased]

## [1.1.0] — 2026-10-05

### Changed

- A new look, matching the web's: its palette and its typeface, Montserrat,
  a green header on each tab with the two main actions as large tiles,
  larger rows and controls with icons, and a floating tab bar. Choosing what a
  field record is now uses four large tiles.
- Clearer wording for a record's local name, a record made from an answer,
  the offline notice, files still to upload and the walkthrough's last step,
  in all three languages.

### Added

- Releases ship to the App Store as well as Google Play, from the same
  commit. `ios.buildNumber` in `app.json` records each iOS build.
- The `production` submit profile sends iOS builds to the app's App Store
  Connect record.
- iOS builds declare that the app uses only exempt encryption (HTTPS and the
  encrypted on-device store), so App Store Connect does not ask on each build.
- `docs/app-store-privacy.md` gives the answers to App Store Connect's App
  Privacy questionnaire, from the same facts as the Google Play data safety
  sheet, which now records how its two open questions were answered.
- Photo previews: each photograph gets a small preview at capture, kept
  encrypted with it and deleted with it once sent (store schema v6). Records
  are listed as cards showing their first photograph, and a record's or an
  interview's photos as a strip.
- The Entrevistas tab says when the device last synced and how much is waiting
  to be sent; Por enviar says when the device is offline.
- A short first-run walkthrough: what the app is for and its three tabs, a
  step at a time, the first time each account signs in on a device. It can be
  skipped, waits until any release notes are closed, and can be seen again
  from the foot of Entrevistas.

- Field records on the device: observed or collected, with coordinates,
  photographs, a voice note and the collecting permit. They are sent with
  `records:sync`, and their media through the record media endpoints.
- A record can be started from an interview answer that names a plant, and is
  linked to it.
- A record that was never sent can be discarded, with its media.
- Three tabs: Entrevistas (projects and every interview on the device),
  Registros, and Por enviar (everything unsent, with a badge).
- Projects refresh quietly when the app opens online.
- Large media resume after a dropped connection: a file over 8 MiB goes up in
  parts, read one at a time from the encrypted store, and only the missing
  parts are sent again (platform ADR 0012).
- "What's new": a sheet after an update with the notes of each release since
  the last one seen on the device, a screen with every release, and this
  changelog.
- A development variant (`APP_VARIANT=development`) that installs beside the
  store build, and a containerised script to build its APK.

### Fixed

- Launch on iOS 27, by adopting the UIKit scene lifecycle.
- On iOS, the prompts that ask for the microphone, location, camera and photos
  are in Spanish, English or Portuguese, following the device's language,
  instead of always in English. They also mention field records as well as
  interviews.
- Media uploads, which failed when the server sent signed headers as lists.
- Edits made while an interview was being pushed are no longer lost.
- A list that cannot be read no longer leaves its tab loading forever.
- Expo SDK 57 patch alignment, past the Hermes regression.
- Dependency advisories that have a fix.

## [1.0.0] — 2026-08-15

First public release: offline interview capture against the project's forms,
with audio, photographs and location, kept in an encrypted store and sent when
the device is back online.

[Unreleased]: https://github.com/padiush/companion/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/padiush/companion/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/padiush/companion/releases/tag/v1.0.0

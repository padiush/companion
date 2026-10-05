# Releasing

The companion ships in releases. A release is one version number that the
store listing, the in-app notes, the changelog, the citation and the tag all
carry.

## Between releases

Every pull request that changes something a researcher or a distributor would
notice adds a line under **Unreleased** in [CHANGELOG.md](../CHANGELOG.md), in
the same change as the code.

The notes researchers see are drafted as the release takes shape, under
`whatsNew.releases` in `src/i18n/locales/{es,en,pt}.json`, newest release first:

```json
{ "version": "1.1.0", "date": null, "items": ["…", "…"] }
```

- **Write for researchers in the field.** Say what they can do now. Leave out
  what only a developer would notice; that belongs in the changelog.
- **Spanish first**, then English and Portuguese, with the same points in the
  same order. The locale test fails if a language differs.
- **Keep `date` null until the release ships.** Notes above the version in
  `app.json` are hidden, so drafting early is safe.

## Cutting a release

1. Pick the number: minor for new features, patch for fixes only, major for a
   change that needs a platform release the old app cannot talk to.
2. Set `expo.version` in `app.json` and `version` in `CITATION.cff`. Leave
   `android.versionCode` to the production build, which increments it.
3. Set the release's `date` in the notes. The locale test fails if a release at
   or below `app.json` has no date, or one above it has a date.
4. In `CHANGELOG.md`, rename **Unreleased** to `[x.y.z] — YYYY-MM-DD`, start a
   new empty **Unreleased**, and update the comparison links.
5. Merge, build and submit with EAS (see the README), and commit the
   `versionCode` the build used.
6. Tag `vx.y.z` on `main` and publish a GitHub release with the changelog
   section. Zenodo archives it; record the version DOI in `CITATION.cff` and
   the README in a follow-up.

## What researchers see

- **After an update.** On the first launch of a new release, a "What's new?"
  sheet lists the notes of every release since the last one seen on the
  device. Closing it records the release as seen. A release with no notes is
  recorded silently.
- **New installs** start on the release installed, with nothing to catch up
  on. An install that was already signed in when this feature arrived is
  treated as an upgrade from 1.0.0.
- **The full history** is on the What's new screen, linked with the version
  number at the bottom of the Entrevistas tab.

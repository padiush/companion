# Screenshots

Takes the app's screenshots in Spanish, English and Portuguese from the iOS
simulator, with the platform's example study on the device. The public website
uses two of them; the rest are for the store listings.

[Maestro](https://maestro.mobile.dev) drives the app through `shots.yaml`, and
`run-shots.sh` prepares a simulator for each language and runs it:

1. Erases the simulator, sets its language and region, and adds the two plant
   photographs in `photos/` to its library.
2. Installs the build, grants its permissions, places it in San Salvador and
   fixes the status bar at 9:41 with full signal and battery.
3. Signs in to an account whose example study is in that language, records one
   finished interview, starts a second with the recorder running, and makes a
   field record with a photograph and the collecting permit.
4. Saves five screens to `out/<language>/…/takeScreenshot/` and shuts the
   simulator down.

| File                | Screen                                                                |
| ------------------- | --------------------------------------------------------------------- |
| `01-interviews.png` | Entrevistas: last sync, what is waiting, the interviews on the device |
| `02-interview.png`  | An interview in progress, recording                                   |
| `03-record.png`     | A field record with its photograph                                    |
| `04-records.png`    | Registros                                                             |
| `05-outbox.png`     | Por enviar                                                            |

## What it needs

- **Maestro** on the Mac (`~/.maestro/maestro/bin/maestro`). It runs on any
  Java 17 or later; the script points `JAVA_HOME` at Android Studio's bundled
  runtime.
- **A development instance of the platform** the simulator can reach on a local
  address, for example an SSH tunnel to `127.0.0.1:8380`.
- **One account per language**, each owning a copy of the example study built
  in its language. On the development instance:

  ```php
  // php artisan tinker
  foreach (['es', 'en', 'pt'] as $l) {
      $u = App\Models\User::firstOrCreate(
          ['email' => "screenshots-$l@padiush.test"],
          ['name' => 'Equipo Padiush', 'password' => Hash::make('<a test password>')],
      );
      $u->forceFill(['email_verified_at' => now(), 'locale' => $l])->save();
      app(App\Services\ExampleStudy::class)->build($u, $l);
  }
  ```

- **A Release simulator build pointed at that instance, with the photo library
  picker.** The app only takes photographs with the camera, and the simulator's
  camera shows a blank test pattern, so the screenshot build swaps in the
  library picker for its photo step. Apply the patch, build, and revert it:

  ```bash
  git apply scripts/screenshots/library-picker.patch
  EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8380/api/v1 \
    npx expo run:ios --configuration Release --device "<simulator>" --no-bundler
  git apply -R scripts/screenshots/library-picker.patch
  ```

  Every screen is otherwise the app as it ships.

## Running it

Create one simulator per language, run them one at a time, and delete them
afterwards; they are large:

```bash
xcrun simctl create "Padiush Shots ES" com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro
SHOTS_PASSWORD='<the test password>' scripts/screenshots/run-shots.sh <udid> es path/to/PadiushCompanion.app
xcrun simctl delete <udid>
```

A freshly erased simulator's accessibility service sometimes crashes the first
app it attaches to, so the script launches the app once before the flow and
retries the flow once.

## The photographs

Both are CC0 (public domain dedication) from Wikimedia Commons:

- `photos/tagetes-erecta.jpg`: _Tagetes erecta_ by Kryesmin,
  [File:Tagetes_erecta_(flowers)_01.jpg](<https://commons.wikimedia.org/wiki/File:Tagetes_erecta_(flowers)_01.jpg>)
- `photos/moringa-oleifera.jpg`: _Moringa oleifera_ by Obsidian Soul,
  [File:Kalamunggay_(Moringa_oleifera),_Philippines.jpg](<https://commons.wikimedia.org/wiki/File:Kalamunggay_(Moringa_oleifera),_Philippines.jpg>)

The second only fills the library, so the marigold lands in the picker's second
cell, where the flow taps.

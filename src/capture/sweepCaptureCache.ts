import { Directory, Paths } from 'expo-file-system';

import { recordDiagnostic } from '../diagnostics';

/**
 * Cache subdirectories the capture APIs spool plaintext media into before
 * `attachMedia` ingests it: expo-audio uses `ExpoAudio/` on iOS and `Audio/`
 * on Android; expo-image-picker uses `ImagePicker/`.
 */
const CAPTURE_CACHE_DIRS = ['ExpoAudio', 'Audio', 'ImagePicker'];

/**
 * Delete capture temp files left behind if the app died mid-capture, so no
 * unencrypted informant media outlives its interview. Runs at cold start,
 * before any capture can begin.
 */
export function sweepCaptureCache(): void {
  for (const name of CAPTURE_CACHE_DIRS) {
    try {
      const dir = new Directory(Paths.cache, name);
      if (dir.exists) {
        dir.delete();
      }
    } catch {
      // Plaintext capture leftovers may still be on disk. The directory name
      // is not reported: the code says enough, and this stays a channel that
      // carries no paths. Fire-and-forget so the remaining dirs still get
      // swept, and so a cold start is not held up by a report.
      void recordDiagnostic('capture_cache_sweep_failed');
    }
  }
}

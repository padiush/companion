import Constants from 'expo-constants';

/** One release's notes, as the locale files carry them, newest first. */
export interface Release {
  version: string;
  /** `YYYY-MM-DD` once shipped; null while the notes are being drafted. */
  date: string | null;
  items: string[];
}

/** The release before this app could say what was new: where upgrades start. */
export const FIRST_RELEASE = '1.0.0';

/** The version this build is, from the app config. */
export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Compare two `major.minor.patch` versions numerically, so 1.10.0 sorts after
 * 1.9.0. Missing parts count as zero.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.');
  const right = b.split('.');

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (parseInt(left[i] ?? '', 10) || 0) - (parseInt(right[i] ?? '', 10) || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

/**
 * The releases up to the one running, newest first. Notes drafted for a
 * release that has not shipped stay hidden until it does.
 */
export function releasedUpTo(releases: unknown, current: string): Release[] {
  return (Array.isArray(releases) ? (releases as Release[]) : [])
    .filter((release) => compareVersions(release.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** The releases after `since` and up to `current`: what has not been seen. */
export function releasesSince(releases: unknown, since: string, current: string): Release[] {
  return releasedUpTo(releases, current).filter(
    (release) => compareVersions(release.version, since) > 0
  );
}

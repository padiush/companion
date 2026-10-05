import app from '../../app.json';
import { compareVersions } from '../whatsNew/releases';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

// Enforces the localization directive: every string exists in every language.
// Spanish is written first and is the source of truth.
describe('locale files', () => {
  it('define the same keys in every language', () => {
    const esKeys = flattenKeys(es).sort();
    expect(flattenKeys(en).sort()).toEqual(esKeys);
    expect(flattenKeys(pt).sort()).toEqual(esKeys);
  });
});

/**
 * Release notes are the one place users read about a release, so a language
 * that drops a point, or dates a release differently, announces a different
 * release depending on who reads it.
 */
describe('release notes', () => {
  const shape = (locale: typeof es) =>
    locale.whatsNew.releases.map(({ version, date, items }) => ({
      version,
      date,
      items: items.length,
    }));

  it('announce the same releases, on the same days, with as many points', () => {
    expect(shape(en)).toEqual(shape(es));
    expect(shape(pt)).toEqual(shape(es));
  });

  it('list releases newest first', () => {
    const versions = es.whatsNew.releases.map((release) => release.version);
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions);
  });

  /**
   * Notes are drafted ahead of a release and dated when it ships. A release
   * that is running with no date shipped without its notes being finished.
   */
  it('date every release up to the app version, and none after', () => {
    for (const release of es.whatsNew.releases) {
      const shipped = compareVersions(release.version, app.expo.version) <= 0;
      expect({ version: release.version, dated: Boolean(release.date) }).toEqual({
        version: release.version,
        dated: shipped,
      });
    }
  });
});

import { compareVersions, releasedUpTo, releasesSince } from './releases';

const releases = [
  { version: '1.10.0', date: null, items: ['drafted'] },
  { version: '1.9.0', date: '2026-12-01', items: ['nine'] },
  { version: '1.1.0', date: '2026-10-10', items: ['one'] },
  { version: '1.0.0', date: '2026-08-15', items: ['first'] },
];

describe('compareVersions', () => {
  it('compares each part as a number, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });
});

describe('releasedUpTo', () => {
  it('hides notes drafted for a release that has not shipped', () => {
    expect(releasedUpTo(releases, '1.9.0').map((r) => r.version)).toEqual([
      '1.9.0',
      '1.1.0',
      '1.0.0',
    ]);
  });

  it('tolerates notes that are not a list', () => {
    expect(releasedUpTo('whatsNew.releases', '1.0.0')).toEqual([]);
  });
});

describe('releasesSince', () => {
  it('is everything after the last release seen, up to the one running', () => {
    expect(releasesSince(releases, '1.0.0', '1.9.0').map((r) => r.version)).toEqual([
      '1.9.0',
      '1.1.0',
    ]);
  });

  it('is nothing for a device that is up to date', () => {
    expect(releasesSince(releases, '1.9.0', '1.9.0')).toEqual([]);
  });
});

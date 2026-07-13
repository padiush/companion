import { formatClock, meteringToLevel } from './audioLevels';

describe('meteringToLevel', () => {
  it('treats missing or NaN readings as silence', () => {
    expect(meteringToLevel(undefined)).toBe(0);
    expect(meteringToLevel(null)).toBe(0);
    expect(meteringToLevel(NaN)).toBe(0);
  });

  it('clamps at or below the silence floor to 0 and at or above 0 dBFS to 1', () => {
    expect(meteringToLevel(-60)).toBe(0);
    expect(meteringToLevel(-90)).toBe(0);
    expect(meteringToLevel(0)).toBe(1);
    expect(meteringToLevel(3)).toBe(1);
  });

  it('maps the mid-range linearly', () => {
    expect(meteringToLevel(-30)).toBeCloseTo(0.5);
    expect(meteringToLevel(-15)).toBeCloseTo(0.75);
  });
});

describe('formatClock', () => {
  it('formats as M:SS with zero-padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5000)).toBe('0:05');
    expect(formatClock(65000)).toBe('1:05');
    expect(formatClock(600000)).toBe('10:00');
  });

  it('floors partial seconds and never goes negative', () => {
    expect(formatClock(1999)).toBe('0:01');
    expect(formatClock(-500)).toBe('0:00');
  });
});

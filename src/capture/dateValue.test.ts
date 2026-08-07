import { formatDate, formatDateTime, parseDate } from './dateValue';

describe('formatDate', () => {
  it('formats to YYYY-MM-DD from local parts', () => {
    expect(formatDate(new Date(2026, 6, 5))).toBe('2026-07-05');
    expect(formatDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('parseDate', () => {
  it('round-trips a date string', () => {
    expect(formatDate(parseDate('2026-07-13'))).toBe('2026-07-13');
  });

  it('falls back to a valid date for empty or invalid input', () => {
    expect(Number.isNaN(parseDate(null).getTime())).toBe(false);
    expect(Number.isNaN(parseDate('').getTime())).toBe(false);
    expect(Number.isNaN(parseDate('not a date').getTime())).toBe(false);
  });
});

describe('formatDateTime', () => {
  /**
   * Asserted by behaviour, not by one runtime's exact ICU output: the point is
   * that it reads in the user's language rather than as a log line, and the
   * precise glyphs vary with the ICU build.
   */
  it('writes the date the way the language does, not as a stored ISO string', () => {
    // A "now" in a later year, so the year is part of the output to assert on.
    const formatted = formatDateTime(new Date(2026, 0, 5, 9, 3), 'es', new Date(2027, 0, 1));

    expect(formatted).toContain('2026');
    expect(formatted).not.toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it('differs between languages that write dates differently', () => {
    const date = new Date(2026, 0, 5, 9, 3);

    expect(formatDateTime(date, 'es')).not.toBe(formatDateTime(date, 'en'));
  });

  it('falls back rather than failing on a locale the runtime rejects', () => {
    // '1' is structurally invalid as a language tag, so Intl throws on it.
    expect(formatDateTime(new Date(2026, 0, 5, 9, 3), '1')).toBe('2026-01-05 09:03');
  });
});

describe('the year in a capture time', () => {
  /**
   * The line this shares has to fit what the interview holds, which is the
   * part worth reading; the current year is the least informative part of it.
   */
  it('is left out for a capture made this year', () => {
    const now = new Date(2026, 7, 6);

    expect(formatDateTime(new Date(2026, 6, 13, 13, 47), 'es', now)).not.toContain('2026');
  });

  it('is kept for a capture from another year', () => {
    const now = new Date(2026, 7, 6);

    expect(formatDateTime(new Date(2025, 6, 13, 13, 47), 'es', now)).toContain('2025');
  });
});

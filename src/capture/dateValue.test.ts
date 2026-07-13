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
  it('formats to YYYY-MM-DD HH:MM with zero-padding from local parts', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 9, 3))).toBe('2026-01-05 09:03');
    expect(formatDateTime(new Date(2026, 6, 13, 14, 28))).toBe('2026-07-13 14:28');
  });
});

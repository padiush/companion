/**
 * Answers store dates as `YYYY-MM-DD` strings. These convert to and from the
 * Date object the native picker uses, working in local time so the calendar day
 * a field worker taps is the day that gets stored.
 */

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string | null): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

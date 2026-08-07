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

/**
 * When a draft was captured, written the way the reader's language writes it.
 *
 * `formatDate` above stays as it is — that one is a *storage* format, and the
 * stored answer must not change shape with the device's locale. This is the
 * display counterpart, and it was previously the same hand-built
 * `YYYY-MM-DD HH:MM`, which reads like a log line in a Spanish-first app.
 *
 * The locale comes from i18next rather than the device, so it follows the
 * language the app is actually being used in.
 */
export function formatDateTime(date: Date, locale?: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      // The year is dropped for the current year. It is the least informative
      // part of a recent capture time, and the line it shares has to fit what
      // the interview actually holds — which is the part worth reading.
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    // A locale the runtime cannot resolve must not take the list down with it.
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${formatDate(date)} ${hours}:${minutes}`;
  }
}

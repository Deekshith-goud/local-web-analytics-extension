/**
 * date-utils.ts
 *
 * Centralized, timezone-safe date calculations.
 * Ensures consistent date boundaries and local timezone transitions across background,
 * popup, and dashboard.
 */

/**
 * Returns local YYYY-MM-DD formatted date string from a Date object.
 */
export function getLocalTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns local YYYY-MM-DD formatted date string from a millisecond timestamp.
 */
export function getLocalDateString(timestamp: number): string {
  return getLocalTodayDateString(new Date(timestamp));
}


/**
 * Returns the millisecond timestamp for the absolute start of a local date (00:00:00.000).
 * Handles DST boundaries safely by creating a Date object with local parameters.
 */
export function getStartOfDayTimestamp(dateStr: string): number {
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  const year = parseInt(parts[0] ?? "0", 10);
  const month = parseInt(parts[1] ?? "1", 10) - 1; // Date month is 0-indexed
  const day = parseInt(parts[2] ?? "1", 10);

  return new Date(year, month, day, 0, 0, 0, 0).getTime();
}

export function getDateRangeList(startMs: number, endMs: number): string[] {
  const dates: string[] = [];
  const startDayStr = getLocalDateString(startMs);
  const endDayStr = getLocalDateString(endMs);

  const startDayTime = getStartOfDayTimestamp(startDayStr);
  const endDayTime = getStartOfDayTimestamp(endDayStr);

  let current = startDayTime;
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Safeguard: infinite loop prevention
  let iterations = 0;
  while (current <= endDayTime && iterations < 366) {
    dates.push(getLocalDateString(current));
    current += oneDayMs;
    iterations++;
  }

  return dates;
}

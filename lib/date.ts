// lib/date.ts

/** Returns today's date as YYYY-MM-DD in America/New_York timezone. */
export function getTodayEST(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });
}

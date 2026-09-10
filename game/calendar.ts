/** Calendar time and economic billing deliberately use separate clocks. */
export const YEAR_SECONDS = 20 * 60;
export const DAYS_PER_YEAR = 28;
export const DAY_SECONDS = YEAR_SECONDS / DAYS_PER_YEAR;
export const BILLING_PERIOD_SECONDS = 90;
export const LEGACY_YEAR_SECONDS = 90 * 12;
export const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_NAMES: Record<Season, string> = {
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
  winter: "Winter",
};
export type CalendarState = { version: 1; offsetSeconds: number };
type CalendarPark = { time: number; calendar?: CalendarState };

/** Preserve the old year and its progress without moving any simulation timers. */
export function initCalendar(s: CalendarPark): void {
  s.calendar ??= {
    version: 1,
    offsetSeconds: (s.time / LEGACY_YEAR_SECONDS) * YEAR_SECONDS - s.time,
  };
}
export const calendarTime = (s: CalendarPark, time = s.time) =>
  time + (s.calendar?.offsetSeconds ?? 0);

export function calendarAt(time: number) {
  const seconds = Math.max(0, Number.isFinite(time) ? time : 0),
    yearIndex = Math.floor(seconds / YEAR_SECONDS + 1e-12),
    yearProgress = Math.max(0, (seconds - yearIndex * YEAR_SECONDS) / YEAR_SECONDS),
    dayInYear = yearProgress * DAYS_PER_YEAR,
    dayIndex = Math.min(DAYS_PER_YEAR - 1, Math.floor(dayInYear + 1e-10)),
    absoluteDay = yearIndex * DAYS_PER_YEAR + dayIndex,
    weekdayIndex = absoluteDay % WEEKDAYS.length,
    season = SEASONS[Math.min(3, Math.floor(yearProgress * 4))];
  return {
    year: yearIndex + 1,
    day: dayIndex + 1,
    absoluteDay,
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex],
    season,
    seasonName: SEASON_NAMES[season],
    dayProgress: Math.max(0, dayInYear - dayIndex),
    yearProgress,
  };
}
export const calendarOf = (s: CalendarPark, time = s.time) => calendarAt(calendarTime(s, time));
export const billingPeriodAt = (time: number) => Math.floor(time / BILLING_PERIOD_SECONDS);

/** Missing metadata is an old save, not a malformed modern calendar. */
export function validCalendar(s: CalendarPark): boolean {
  if (s.calendar === undefined) return true;
  const c = s.calendar;
  return (
    !!c &&
    !Array.isArray(c) &&
    c.version === 1 &&
    Number.isFinite(c.offsetSeconds) &&
    c.offsetSeconds >= 0 &&
    Number.isFinite(s.time + c.offsetSeconds)
  );
}

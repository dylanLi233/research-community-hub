import { isValidCalendarDate } from "@/reports/validation";

const DAY_MS = 24 * 60 * 60 * 1000;

export type EventWeek = {
  start: string;
  end: string;
  previous: string;
  next: string;
};

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function mondayForDate(value: string): string {
  if (!isValidCalendarDate(value)) {
    throw new Error("Invalid calendar date");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return formatUtcDate(addUtcDays(date, offset));
}

export function resolveEventWeek(
  requestedDate: string | null,
  now = new Date(),
): EventWeek {
  const fallback = formatUtcDate(now);
  const sourceDate =
    requestedDate && isValidCalendarDate(requestedDate)
      ? requestedDate
      : fallback;
  const start = mondayForDate(sourceDate);
  const startDate = new Date(`${start}T00:00:00.000Z`);

  return {
    start,
    end: formatUtcDate(addUtcDays(startDate, 6)),
    previous: formatUtcDate(addUtcDays(startDate, -7)),
    next: formatUtcDate(addUtcDays(startDate, 7)),
  };
}

export function weekDates(weekStart: string): string[] {
  const start = new Date(`${mondayForDate(weekStart)}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) =>
    formatUtcDate(addUtcDays(start, index)),
  );
}

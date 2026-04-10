import {
  format,
  parseISO,
  isWeekend,
  eachDayOfInterval,
  differenceInBusinessDays,
  isAfter,
  isBefore,
  isSameDay,
  addDays,
} from "date-fns";
import { TIME_OFF_START, TIME_OFF_END, BLOCKED_DATES } from "./types";

/** All calendar days (including weekends), excluding blocked dates. Used for the planner strip. */
export function getUsableDays(): string[] {
  const start = parseISO(TIME_OFF_START);
  const end = parseISO(TIME_OFF_END);
  const allDays = eachDayOfInterval({ start, end });

  return allDays
    .filter((d) => {
      const iso = format(d, "yyyy-MM-dd");
      if (BLOCKED_DATES.includes(iso)) return false;
      return true;
    })
    .map((d) => format(d, "yyyy-MM-dd"));
}

/** Business days remaining (weekdays only, excluding blocked). Used for the countdown. */
export function getRemainingUsableDays(): string[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return getUsableDays().filter((d) => {
    if (d < today) return false;
    const date = parseISO(d);
    if (isWeekend(date)) return false;
    return true;
  });
}

export function getDaysRemaining(): number {
  return getRemainingUsableDays().length;
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), "EEE, MMM d");
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

export function formatDayOfWeek(iso: string): string {
  return format(parseISO(iso), "EEE");
}

export function isToday(iso: string): boolean {
  return isSameDay(parseISO(iso), new Date());
}

export function getTodayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

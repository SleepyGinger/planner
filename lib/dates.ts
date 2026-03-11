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

export function getUsableDays(): string[] {
  const start = parseISO(TIME_OFF_START);
  const end = parseISO(TIME_OFF_END);
  const allDays = eachDayOfInterval({ start, end });

  return allDays
    .filter((d) => {
      if (isWeekend(d)) return false;
      const iso = format(d, "yyyy-MM-dd");
      if (BLOCKED_DATES.includes(iso)) return false;
      return true;
    })
    .map((d) => format(d, "yyyy-MM-dd"));
}

export function getRemainingUsableDays(): string[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return getUsableDays().filter((d) => d >= today);
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

export function isToday(iso: string): boolean {
  return isSameDay(parseISO(iso), new Date());
}

export function getTodayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

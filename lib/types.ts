export type TaskStatus = "todo" | "done";

export type TaskCategory =
  | "errands"
  | "projects"
  | "health/fitness"
  | "learning"
  | "fun/experiences"
  | "social"
  | "home"
  | "admin";

export const CATEGORIES: TaskCategory[] = [
  "errands",
  "projects",
  "health/fitness",
  "learning",
  "fun/experiences",
  "social",
  "home",
  "admin",
];

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: 1 | 2 | 3;
  estimatedMinutes: number;
  status: TaskStatus;
  plannedDate: string | null; // ISO date string YYYY-MM-DD
  dumpId: string | null;
  userId: string;
  createdAt: string;
  completedAt: string | null;
}

export interface Dump {
  id: string;
  rawText: string;
  userId: string;
  createdAt: string;
}

export interface ParsedTask {
  title: string;
  description: string;
  category: TaskCategory;
  priority: 1 | 2 | 3;
  estimatedMinutes: number;
}

// The 28 business days off: March 11 - April 17, 2026
// April 6-10 reserved for daughter care
export const TIME_OFF_START = "2026-03-11";
export const TIME_OFF_END = "2026-04-17";
export const BLOCKED_DATES = [
  "2026-04-06",
  "2026-04-07",
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
];
export const TOTAL_USABLE_DAYS = 23;

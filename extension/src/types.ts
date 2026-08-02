export type EventType = "study" | "exam" | "other" | "unknown";

export type CalendarEvent = {
  eventType: EventType;
  sourcePage: "study-calendar" | "exam-calendar";
  sourceExtractor: "page-state" | "dom";
  subject: string;
  classCode?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  startPeriod?: number;
  endPeriod?: number;
  room?: string;
  instructor?: string;
  studyMode?: string;
  examFormat?: string;
  examSession?: string;
  durationMinutes?: number;
  studentNumber?: string;
  note?: string;
  rawText?: string;
  sourceWeek?: string;
};

export type CourseWithoutDetail = {
  classCode?: string;
  subject: string;
  studyMode?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
};

export type PageStateSnapshot = {
  events: Record<string, unknown>[];
  courses: Record<string, unknown>[];
};

export type ScanStatus = {
  phase: "idle" | "running" | "done" | "error" | "stopped";
  title: string;
  message: string;
  scannedWeeks: number;
  weekLabel?: string;
  eventCount: number;
  studyCount?: number;
  examCount?: number;
  percent?: number;
  updatedAt: string;
};

export type ScanOptions = {
  outputCsv: boolean;
  outputIcs: boolean;
  outputJson: boolean;
  privateEvents: boolean;
  includeUnknown: boolean;
};

export const STORAGE_KEY = "utcCalendarExporterStatus";

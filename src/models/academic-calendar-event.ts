import { z } from "zod";

export const calendarEventTypeSchema = z.enum(["study", "exam", "other", "unknown"]);
export const sourcePageSchema = z.enum(["study-calendar", "exam-calendar"]);
export const sourceExtractorSchema = z.enum(["network-json", "network-html", "dom"]);
export const classificationSchema = z.enum(["explicit", "inferred", "unknown"]);

export const academicCalendarEventSchema = z.object({
  eventType: calendarEventTypeSchema,
  sourcePage: sourcePageSchema,
  sourceExtractor: sourceExtractorSchema,
  sources: z.array(sourcePageSchema).min(1),
  subject: z.string().min(1),
  classCode: z.string().optional(),
  group: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startPeriod: z.number().int().positive().optional(),
  endPeriod: z.number().int().positive().optional(),
  room: z.string().optional(),
  location: z.string().optional(),
  instructor: z.string().optional(),
  studyMode: z.string().optional(),
  examSession: z.string().optional(),
  examFormat: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  studentNumber: z.string().optional(),
  note: z.string().optional(),
  rawText: z.string().optional(),
  rawTexts: z.array(z.string()).optional(),
  sourceWeek: z.string().optional(),
  classification: classificationSchema,
  classificationConfidence: z.number().min(0).max(1),
  classificationReasons: z.array(z.string()).optional(),
});

export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type SourcePage = z.infer<typeof sourcePageSchema>;
export type SourceExtractor = z.infer<typeof sourceExtractorSchema>;
export type AcademicCalendarEvent = z.infer<typeof academicCalendarEventSchema>;

export type RawAcademicEvent = {
  sourcePage: SourcePage;
  sourceExtractor: SourceExtractor;
  subject?: string;
  classCode?: string;
  group?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  startPeriod?: number;
  endPeriod?: number;
  room?: string;
  location?: string;
  instructor?: string;
  studyMode?: string;
  examSession?: string;
  examFormat?: string;
  durationMinutes?: number;
  studentNumber?: string;
  note?: string;
  rawText?: string;
  sourceWeek?: string;
  backendFields?: Record<string, unknown>;
};

export type CourseWithoutDetail = {
  classCode?: string;
  subject: string;
  studyMode?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  rawText?: string;
};

export type WeekScanResult = {
  weekStart?: string;
  weekEnd?: string;
  weekLabel: string;
  loadedSuccessfully: boolean;
  events: AcademicCalendarEvent[];
  coursesWithoutDetail: CourseWithoutDetail[];
  extractor?: SourceExtractor;
  error?: string;
};

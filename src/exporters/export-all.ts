import fs from "node:fs/promises";
import path from "node:path";
import type { AcademicCalendarEvent, CourseWithoutDetail } from "../models/academic-calendar-event.js";
import { OUTPUT_DIR } from "../config.js";
import { writeJson } from "../utils/filesystem.js";
import { writeCoursesWithoutDetailCsv, writeGoogleCsv } from "./google-csv-exporter.js";
import { writeIcs } from "./ics-exporter.js";

export type ExportSummary = { skippedUntimed: number; files: string[] };

async function writeCalendarPair(baseName: string, events: AcademicCalendarEvent[], privateEvents: boolean, files: string[]): Promise<number> {
  const csv = path.join(OUTPUT_DIR, `${baseName}_google.csv`);
  const ics = path.join(OUTPUT_DIR, `${baseName}.ics`);
  const skippedCsv = await writeGoogleCsv(csv, events, privateEvents);
  const skippedIcs = await writeIcs(ics, events, privateEvents);
  files.push(csv, ics);
  return Math.max(skippedCsv, skippedIcs);
}

export async function exportAll(
  events: AcademicCalendarEvent[],
  rawEvents: AcademicCalendarEvent[],
  courses: CourseWithoutDetail[],
  options: { privateEvents: boolean; includeUnknown: boolean; saveRawJson: boolean },
): Promise<ExportSummary> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const study = events.filter((event) => event.eventType === "study");
  const exams = events.filter((event) => event.eventType === "exam");
  const other = events.filter((event) => event.eventType === "other");
  const unknown = events.filter((event) => event.eventType === "unknown");
  const full = options.includeUnknown ? events : [...study, ...exams, ...other];
  const files: string[] = [];
  let skippedUntimed = 0;

  skippedUntimed += await writeCalendarPair("utc_study_calendar", study, options.privateEvents, files);
  skippedUntimed += await writeCalendarPair("utc_exam_calendar", exams, options.privateEvents, files);
  skippedUntimed += await writeCalendarPair("utc_full_academic_calendar", full, options.privateEvents, files);

  const normalized = path.join(OUTPUT_DIR, "utc_full_academic_calendar.normalized.json");
  const unknownFile = path.join(OUTPUT_DIR, "utc_unknown_events.json");
  const coursesJson = path.join(OUTPUT_DIR, "courses_without_detail.json");
  const coursesCsv = path.join(OUTPUT_DIR, "courses_without_detail.csv");
  await writeJson(normalized, events);
  await writeJson(unknownFile, unknown);
  await writeJson(coursesJson, courses);
  await writeCoursesWithoutDetailCsv(coursesCsv, courses);
  files.push(normalized, unknownFile, coursesJson, coursesCsv);

  if (options.saveRawJson) {
    const rawFile = path.join(OUTPUT_DIR, "utc_full_academic_calendar.raw.json");
    await writeJson(rawFile, rawEvents);
    files.push(rawFile);
  }
  return { skippedUntimed, files };
}

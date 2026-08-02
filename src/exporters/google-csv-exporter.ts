import fs from "node:fs/promises";
import path from "node:path";
import type { AcademicCalendarEvent, CourseWithoutDetail } from "../models/academic-calendar-event.js";
import { toGoogleDate, toGoogleTime, nowIso } from "../utils/date.js";
import { ensureDir } from "../utils/filesystem.js";

const HEADERS = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location", "Private"];

export function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function title(event: AcademicCalendarEvent): string {
  if (event.eventType === "exam") return `[THI] ${event.subject}`;
  if (event.eventType === "other") return `[HỌC VỤ] ${event.subject}`;
  if (event.eventType === "unknown") return `[CHƯA PHÂN LOẠI] ${event.subject}`;
  return event.subject;
}

function description(event: AcademicCalendarEvent): string {
  const room = event.room ?? event.location;
  return [
    event.classCode ? `Mã lớp: ${event.classCode}` : undefined,
    room ? `Phòng học: ${room}` : undefined,
    event.startPeriod ? `Tiết: ${event.startPeriod}${event.endPeriod ? `-${event.endPeriod}` : ""}` : undefined,
    event.studyMode ? `Hình thức học: ${event.studyMode}` : undefined,
    event.instructor ? `Giảng viên: ${event.instructor}` : undefined,
    event.examFormat ? `Hình thức thi: ${event.examFormat}` : undefined,
    event.examSession ? `Ca thi: ${event.examSession}` : undefined,
    event.durationMinutes ? `Thời lượng: ${event.durationMinutes} phút` : undefined,
    event.note ? `Ghi chú: ${event.note}` : undefined,
    "Nguồn: QLĐT UTC",
    `Ngày lấy dữ liệu: ${nowIso()}`,
  ].filter(Boolean).join("\n");
}

export function toGoogleCsv(events: AcademicCalendarEvent[], privateEvents: boolean): { content: string; skipped: number } {
  const rows: string[][] = [HEADERS];
  let skipped = 0;
  for (const event of events) {
    if (!event.startTime || !event.endTime) {
      skipped += 1;
      continue;
    }
    rows.push([
      title(event),
      toGoogleDate(event.date),
      toGoogleTime(event.startTime),
      toGoogleDate(event.date),
      toGoogleTime(event.endTime),
      "False",
      description(event),
      event.location ?? event.room ?? "",
      privateEvents ? "True" : "False",
    ]);
  }
  return { content: `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`, skipped };
}

export async function writeGoogleCsv(filePath: string, events: AcademicCalendarEvent[], privateEvents: boolean): Promise<number> {
  await ensureDir(path.dirname(filePath));
  const result = toGoogleCsv(events, privateEvents);
  await fs.writeFile(filePath, result.content, "utf8");
  return result.skipped;
}

export async function writeCoursesWithoutDetailCsv(filePath: string, courses: CourseWithoutDetail[]): Promise<void> {
  const headers = ["Class Code", "Subject", "Study Mode", "Start Date", "End Date", "Note", "Raw Text"];
  const rows = [headers, ...courses.map((course) => [course.classCode ?? "", course.subject, course.studyMode ?? "", course.startDate ?? "", course.endDate ?? "", course.note ?? "", course.rawText ?? ""])];
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`, "utf8");
}

import fs from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import type { AcademicCalendarEvent } from "../models/academic-calendar-event.js";
import { TIME_ZONE } from "../config.js";
import { eventIdentityKey } from "../utils/deduplicate.js";
import { ensureDir } from "../utils/filesystem.js";

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let limit = 75;
  for (const char of line) {
    const candidate = current + char;
    if (Buffer.byteLength(candidate, "utf8") > limit) {
      chunks.push(current);
      current = char;
      limit = 74;
    } else current = candidate;
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n ");
}

function icsDateTime(date: string, time: string): string {
  return DateTime.fromISO(`${date}T${time}`, { zone: TIME_ZONE }).toFormat("yyyyMMdd'T'HHmmss");
}

function eventTitle(event: AcademicCalendarEvent): string {
  const prefix = event.eventType === "exam" ? "[THI] " : event.eventType === "other" ? "[HỌC VỤ] " : event.eventType === "unknown" ? "[CHƯA PHÂN LOẠI] " : "";
  return `${prefix}${event.subject}`;
}

function eventDescription(event: AcademicCalendarEvent): string {
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
  ].filter(Boolean).join("\n");
}

export function toIcs(events: AcademicCalendarEvent[], privateEvents: boolean): { content: string; skipped: number } {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UTC Timetable Exporter//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Ho_Chi_Minh",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  let skipped = 0;
  const stamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  for (const event of events) {
    if (!event.startTime || !event.endTime) {
      skipped += 1;
      continue;
    }
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventIdentityKey(event)}@utc-timetable-exporter.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${icsDateTime(event.date, event.startTime)}`,
      `DTEND;TZID=Asia/Ho_Chi_Minh:${icsDateTime(event.date, event.endTime)}`,
      `SUMMARY:${escapeIcsText(eventTitle(event))}`,
      `DESCRIPTION:${escapeIcsText(eventDescription(event))}`,
      `LOCATION:${escapeIcsText(event.location ?? event.room ?? "")}`,
      `CLASS:${privateEvents ? "PRIVATE" : "PUBLIC"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return { content: `${lines.map(foldIcsLine).join("\r\n")}\r\n`, skipped };
}

export async function writeIcs(filePath: string, events: AcademicCalendarEvent[], privateEvents: boolean): Promise<number> {
  await ensureDir(path.dirname(filePath));
  const result = toIcs(events, privateEvents);
  await fs.writeFile(filePath, result.content, "utf8");
  return result.skipped;
}

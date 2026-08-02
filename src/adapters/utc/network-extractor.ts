import type { AcademicCalendarEvent, RawAcademicEvent, SourcePage } from "../../models/academic-calendar-event.js";
import type { NetworkRecord } from "../../discovery/network-recorder.js";
import { load } from "cheerio";
import { parseTime, parseVietnameseDate } from "../../utils/date.js";
import { stripVietnameseDiacritics } from "../../utils/text.js";
import { parseRawEvent } from "./parsers.js";
import { selectors } from "./selectors.js";

function normalizedKey(key: string): string {
  return stripVietnameseDiacritics(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function valueFor(object: Record<string, unknown>, aliases: string[]): unknown {
  const wanted = new Set(aliases.map(normalizedKey));
  const entry = Object.entries(object).find(([key]) => wanted.has(normalizedKey(key)));
  return entry?.[1];
}

function stringFor(object: Record<string, unknown>, aliases: string[]): string | undefined {
  const value = valueFor(object, aliases);
  return typeof value === "string" || typeof value === "number" ? String(value).trim() || undefined : undefined;
}

function numberFor(object: Record<string, unknown>, aliases: string[]): number | undefined {
  const value = valueFor(object, aliases);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function collectObjects(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  output.push(object);
  for (const nested of Object.values(object)) collectObjects(nested, output);
}

function looksLikeEvent(object: Record<string, unknown>): boolean {
  const keys = Object.keys(object).map(normalizedKey);
  const hasSubject = keys.some((key) => ["tenmon", "tenmonhoc", "subject", "coursename", "tenhocphan"].includes(key));
  const hasDate = keys.some((key) => ["ngay", "ngayhoc", "ngaythi", "date", "startdate", "tungay"].includes(key));
  const hasSchedule = keys.some((key) => /(giobatdau|starttime|tietbatdau|phong|room|cathi)/.test(key));
  return hasSubject && (hasDate || hasSchedule);
}

export function extractEventsFromNetworkRecords(records: NetworkRecord[], sourcePage: SourcePage, weekLabel: string): AcademicCalendarEvent[] {
  const output: AcademicCalendarEvent[] = [];
  for (const record of records) {
    if (!record.responseBody || !/json/i.test(record.contentType ?? "")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(record.responseBody);
    } catch {
      continue;
    }
    const objects: Record<string, unknown>[] = [];
    collectObjects(parsed, objects);
    for (const object of objects.filter(looksLikeEvent)) {
      const dateValue = stringFor(object, ["ngay", "ngayHoc", "ngayThi", "date", "startDate"]);
      const raw: RawAcademicEvent = {
        sourcePage,
        sourceExtractor: "network-json",
        subject: stringFor(object, ["tenMon", "tenMonHoc", "subject", "courseName", "tenHocPhan"]),
        classCode: stringFor(object, ["maLop", "maLopHocPhan", "classCode", "maHocPhan"]),
        group: stringFor(object, ["nhom", "group", "nhomHoc"]),
        date: dateValue ? parseVietnameseDate(dateValue) ?? dateValue.slice(0, 10) : undefined,
        startTime: (() => { const value = stringFor(object, ["gioBatDau", "startTime", "tuGio"]); return value ? parseTime(value) : undefined; })(),
        endTime: (() => { const value = stringFor(object, ["gioKetThuc", "endTime", "denGio"]); return value ? parseTime(value) : undefined; })(),
        startPeriod: numberFor(object, ["tietBatDau", "startPeriod", "tuTiet"]),
        endPeriod: numberFor(object, ["tietKetThuc", "endPeriod", "denTiet"]),
        room: stringFor(object, ["phong", "phongHoc", "phongThi", "room"]),
        studyMode: stringFor(object, ["hinhThucHoc", "studyMode"]),
        examSession: stringFor(object, ["caThi", "examSession"]),
        examFormat: stringFor(object, ["hinhThucThi", "examFormat", "examType"]),
        durationMinutes: numberFor(object, ["thoiLuong", "duration", "durationMinutes"]),
        note: stringFor(object, ["ghiChu", "note", "description"]),
        rawText: JSON.stringify(object),
        sourceWeek: weekLabel,
        backendFields: object,
      };
      const event = parseRawEvent(raw);
      if (event) output.push(event);
    }
  }
  return output;
}

export function extractEventsFromNetworkHtml(records: NetworkRecord[], sourcePage: SourcePage, weekLabel: string): AcademicCalendarEvent[] {
  const output: AcademicCalendarEvent[] = [];
  for (const record of records) {
    if (!record.responseBody || !/html/i.test(record.contentType ?? "")) continue;
    const $ = load(record.responseBody);
    const seen = new Set<any>();
    for (const selector of selectors.eventCards) {
      $(selector).each((_, element) => {
        if (seen.has(element)) return;
        seen.add(element);
        const node = $(element);
        const raw: RawAcademicEvent = {
          sourcePage,
          sourceExtractor: "network-html",
          date: node.attr("data-date") ?? node.closest("[data-date]").attr("data-date"),
          rawText: [node.attr("title"), node.text()].filter(Boolean).join("\n"),
          sourceWeek: weekLabel,
        };
        const parsed = parseRawEvent(raw);
        if (parsed) output.push(parsed);
      });
    }
  }
  return output;
}

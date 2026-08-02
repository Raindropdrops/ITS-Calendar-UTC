import type { Page } from "playwright";
import type { AcademicCalendarEvent, RawAcademicEvent } from "../../models/academic-calendar-event.js";
import { parseRawEvent } from "./parsers.js";

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function timeFromParts(hour: unknown, minute: unknown): string | undefined {
  const h = numberValue(hour);
  const m = numberValue(minute);
  if (h === undefined || m === undefined || h < 0 || h > 23 || m < 0 || m > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function extractEventsFromPageState(page: Page, weekLabel: string): Promise<AcademicCalendarEvent[]> {
  const rows = await page.evaluate((): Record<string, unknown>[] => {
    const value = (window as any).main_doc?.LichGiang?.dtLichHoc;
    if (!Array.isArray(value)) return [];
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>[];
  }).catch(() => [] as Record<string, unknown>[]);

  const events: AcademicCalendarEvent[] = [];
  for (const row of rows) {
    const raw: RawAcademicEvent = {
      sourcePage: "study-calendar",
      sourceExtractor: "network-json",
      subject: stringValue(row.TENHOCPHAN),
      classCode: stringValue(row.MALOP ?? row.MAHOCPHAN ?? row.TENLOPHOCPHAN),
      group: stringValue(row.NHOM ?? row.NHOMHOC),
      date: stringValue(row.NGAYHOC),
      startTime: timeFromParts(row.GIOBATDAU, row.PHUTBATDAU),
      endTime: timeFromParts(row.GIOKETTHUC, row.PHUTKETTHUC),
      startPeriod: numberValue(row.TIETBATDAU),
      endPeriod: numberValue(row.TIETKETTHUC),
      room: stringValue(row.TENPHONGHOC ?? row.PHONGHOC_TEN),
      instructor: stringValue(row.GIANGVIEN),
      examSession: stringValue(row.CATHI),
      examFormat: stringValue(row.HINHTHUCTHI),
      studentNumber: stringValue(row.SOBAODANH),
      note: stringValue(row.THONGTINCHUYENCAN ?? row.GHICHU),
      rawText: JSON.stringify(row),
      sourceWeek: weekLabel,
      backendFields: row,
    };
    const event = parseRawEvent(raw);
    if (event) events.push(event);
  }
  return events;
}

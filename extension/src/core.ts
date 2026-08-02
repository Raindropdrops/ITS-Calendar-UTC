import type { CalendarEvent, CourseWithoutDetail, PageStateSnapshot } from "./types.js";

const textValue = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const clean = String(value).normalize("NFC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return clean || undefined;
};

const numberValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseVietnameseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTime(value?: string): string | undefined {
  const match = value?.match(/(?:^|\D)([01]?\d|2[0-3])[:h.]([0-5]\d)(?:\D|$)/i);
  return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : undefined;
}

function timeFromParts(hour: unknown, minute: unknown): string | undefined {
  const h = numberValue(hour);
  const m = numberValue(minute);
  return h !== undefined && m !== undefined && h >= 0 && h <= 23 && m >= 0 && m <= 59
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    : undefined;
}

function isExamRow(row: Record<string, unknown>): boolean {
  return Object.entries(row).some(([key, value]) =>
    (/^(isExam|laLichThi)$/i.test(key) && [true, 1, "true"].includes(value as never))
    || (/^(eventType|scheduleType|loaiLich|loaiSuKien|phanLoai)$/i.test(key) && /thi|exam/i.test(String(value))),
  );
}

export function extractStateEvents(snapshot: PageStateSnapshot, weekLabel: string): CalendarEvent[] {
  return snapshot.events.flatMap((row): CalendarEvent[] => {
    const subject = textValue(row.TENHOCPHAN ?? row.TENMONHOC ?? row.TENLOP);
    const date = parseVietnameseDate(textValue(row.NGAYHOC ?? row.NGAYTHI));
    if (!subject || !date) return [];
    return [{
      eventType: isExamRow(row) || row.CATHI || row.HINHTHUCTHI ? "exam" : "study",
      sourcePage: "study-calendar",
      sourceExtractor: "page-state",
      subject,
      classCode: textValue(row.MALOP ?? row.MAHOCPHAN ?? row.TENLOPHOCPHAN),
      date,
      startTime: timeFromParts(row.GIOBATDAU, row.PHUTBATDAU) ?? parseTime(textValue(row.GIOHOC ?? row.GIOTHI)),
      endTime: timeFromParts(row.GIOKETTHUC, row.PHUTKETTHUC),
      startPeriod: numberValue(row.TIETBATDAU),
      endPeriod: numberValue(row.TIETKETTHUC),
      room: textValue(row.TENPHONGHOC ?? row.PHONGHOC_TEN ?? row.PHONGTHI),
      instructor: textValue(row.GIANGVIEN),
      studyMode: textValue(row.TENHINHTHUCHOC ?? row.HINHTHUCHOC),
      examSession: textValue(row.CATHI),
      examFormat: textValue(row.HINHTHUCTHI),
      note: textValue(row.THONGTINCHUYENCAN ?? row.GHICHU),
      rawText: JSON.stringify(row),
      sourceWeek: weekLabel,
    }];
  });
}

export function extractStateCourses(snapshot: PageStateSnapshot): CourseWithoutDetail[] {
  return snapshot.courses.flatMap((row): CourseWithoutDetail[] => {
    const subject = textValue(row.TENLOP ?? row.TENHOCPHAN);
    if (!subject) return [];
    return [{
      classCode: textValue(row.MALOP),
      subject,
      studyMode: textValue(row.TENHINHTHUCHOC),
      startDate: parseVietnameseDate(textValue(row.NGAYBATDAU)),
      endDate: parseVietnameseDate(textValue(row.NGAYKETTHUC)),
      note: textValue(row.GHICHU),
    }];
  });
}

function descriptionLines(element: Element): string[] {
  const description = element.querySelector(".task-description");
  if (!description) return [];
  const clone = description.cloneNode(true) as HTMLElement;
  clone.querySelector(".eval")?.remove();
  for (const br of Array.from(clone.querySelectorAll("br"))) br.replaceWith("\n");
  return (clone.textContent ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

export function extractDomEvents(doc: Document, weekLabel: string): CalendarEvent[] {
  return Array.from(doc.querySelectorAll("#datebody .task")).flatMap((element): CalendarEvent[] => {
    const rowId = element.closest(".day-of-week")?.id;
    const dateMatch = rowId?.match(/row(\d{2})(\d{2})(\d{4})/i);
    const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : undefined;
    const subject = element.querySelector(".title")?.textContent?.trim().replace(/^Lịch thi:\s*/i, "");
    if (!date || !subject) return [];
    const timeText = element.querySelector(".task-date")?.textContent?.trim() ?? "";
    const range = timeText.match(/(\d{1,2}[:h.]\d{2})\s*(?:-|–|—)\s*(\d{1,2}[:h.]\d{2})/i);
    const periods = timeText.match(/Tiết\s*(\d{1,2})\s*(?:-|–|—)\s*(\d{1,2})/i);
    const lines = descriptionLines(element);
    return [{
      eventType: element.classList.contains("btnLichThi") || /^Lịch thi:/i.test(element.querySelector(".title")?.textContent ?? "") ? "exam" : "study",
      sourcePage: "study-calendar",
      sourceExtractor: "dom",
      subject,
      classCode: lines[0],
      date,
      startTime: parseTime(range?.[1]),
      endTime: parseTime(range?.[2]),
      startPeriod: periods?.[1] ? Number(periods[1]) : undefined,
      endPeriod: periods?.[2] ? Number(periods[2]) : undefined,
      room: lines.at(-1),
      rawText: [subject, timeText, ...lines].join("\n"),
      sourceWeek: weekLabel,
    }];
  });
}

export function extractDomCourses(doc: Document): CourseWithoutDetail[] {
  return Array.from(doc.querySelectorAll("#tblTKBKhongLichChiTiet tbody tr")).flatMap((row): CourseWithoutDetail[] => {
    const cells = Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() ?? "");
    if (cells.length < 2 || !cells[1]) return [];
    return [{
      classCode: cells[0] || undefined,
      subject: cells[1],
      studyMode: cells[2] || undefined,
      startDate: parseVietnameseDate(cells[3]),
      endDate: parseVietnameseDate(cells[4]),
      note: cells[5] || undefined,
    }];
  });
}

export function extractExamTableEvents(doc: Document): CalendarEvent[] {
  const definitions = [
    { selector: "#tblLichThiCaNhan tbody tr", personal: true },
    { selector: "#tblLichThiChung tbody tr", personal: false },
  ];
  return definitions.flatMap(({ selector, personal }) => Array.from(doc.querySelectorAll(selector)).flatMap((row): CalendarEvent[] => {
    const cells = Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() ?? "");
    const subject = cells[2];
    const date = parseVietnameseDate(cells[personal ? 4 : 3]);
    if (!subject || !date) return [];
    const time = cells[personal ? 5 : 4] ?? "";
    const range = time.match(/(\d{1,2}[:h.]\d{2})\s*(?:-|–|—)\s*(\d{1,2}[:h.]\d{2})/i);
    return [{
      eventType: "exam",
      sourcePage: "exam-calendar",
      sourceExtractor: "dom",
      classCode: cells[1] || undefined,
      subject,
      date,
      startTime: parseTime(range?.[1] ?? time),
      endTime: parseTime(range?.[2]),
      examFormat: cells[personal ? 6 : 5] || undefined,
      room: cells[personal ? 7 : 6] || undefined,
      studentNumber: cells[personal ? 8 : 7] || undefined,
      note: personal && cells[3] ? `Lần thi: ${cells[3]}` : undefined,
      rawText: cells.join("\n"),
    }];
  }));
}

function identityText(value?: string): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN").replace(/^phong\s+/, "").replace(/\s+/g, " ").trim();
}

export function eventIdentity(event: CalendarEvent): string {
  return [event.eventType, event.date, event.startTime ?? "", event.endTime ?? "", identityText(event.subject), identityText(event.room), identityText(event.classCode)].join("|");
}

function fuzzySame(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.eventType !== b.eventType || a.date !== b.date) return false;
  if (a.startTime && b.startTime && a.startTime !== b.startTime) return false;
  if (identityText(a.subject) !== identityText(b.subject)) return false;
  if (a.room && b.room && identityText(a.room) !== identityText(b.room)) return false;
  if (a.classCode && b.classCode && identityText(a.classCode) !== identityText(b.classCode)) return false;
  return true;
}

export function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const unique: CalendarEvent[] = [];
  for (const event of events) {
    const index = unique.findIndex((candidate) => eventIdentity(candidate) === eventIdentity(event) || fuzzySame(candidate, event));
    if (index < 0) unique.push(event);
    else {
      const current = unique[index]!;
      unique[index] = {
        ...current,
        ...event,
        sourceExtractor: current.sourceExtractor === "page-state" ? current.sourceExtractor : event.sourceExtractor,
        sourcePage: current.sourcePage === "exam-calendar" ? current.sourcePage : event.sourcePage,
        endTime: event.endTime ?? current.endTime,
        room: event.room ?? current.room,
        classCode: event.classCode ?? current.classCode,
        examFormat: event.examFormat ?? current.examFormat,
      };
    }
  }
  return unique.sort((a, b) => `${a.date}T${a.startTime ?? ""}`.localeCompare(`${b.date}T${b.startTime ?? ""}`));
}

export function isoAddWeeks(iso: string, weeks: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function weekDistance(from: string, to: string): number {
  return Math.max(0, Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 604_800_000));
}

const csvEscape = (value: unknown): string => {
  const text = value === undefined || value === null
    ? ""
    : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function googleDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

function googleTime(time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function eventTitle(event: CalendarEvent): string {
  const prefix = event.eventType === "exam" ? "[THI] " : event.eventType === "other" ? "[HỌC VỤ] " : event.eventType === "unknown" ? "[CHƯA PHÂN LOẠI] " : "";
  return `${prefix}${event.subject}`;
}

function eventDescription(event: CalendarEvent): string {
  return [
    event.classCode ? `Mã lớp: ${event.classCode}` : undefined,
    event.room ? `Phòng học: ${event.room}` : undefined,
    event.startPeriod ? `Tiết: ${event.startPeriod}${event.endPeriod ? `-${event.endPeriod}` : ""}` : undefined,
    event.studyMode ? `Hình thức học: ${event.studyMode}` : undefined,
    event.instructor ? `Giảng viên: ${event.instructor}` : undefined,
    event.examFormat ? `Hình thức thi: ${event.examFormat}` : undefined,
    event.examSession ? `Ca thi: ${event.examSession}` : undefined,
    event.note ? `Ghi chú: ${event.note}` : undefined,
    "Nguồn: QLĐT UTC",
  ].filter(Boolean).join("\n");
}

export function toGoogleCsv(events: CalendarEvent[], privateEvents: boolean): string {
  const headers = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location", "Private"];
  const rows: unknown[][] = [headers];
  for (const event of events) {
    if (!event.startTime || !event.endTime) continue;
    rows.push([eventTitle(event), googleDate(event.date), googleTime(event.startTime), googleDate(event.date), googleTime(event.endTime), "False", eventDescription(event), event.room ?? "", privateEvents ? "True" : "False"]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

const escapeIcs = (value: string): string => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

function foldIcs(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  let limit = 75;
  for (const char of line) {
    if (encoder.encode(current + char).length > limit) {
      lines.push(current);
      current = char;
      limit = 74;
    } else current += char;
  }
  if (current) lines.push(current);
  return lines.join("\r\n ");
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function toIcs(events: CalendarEvent[], privateEvents: boolean): Promise<string> {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UTC Calendar Exporter Extension//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VTIMEZONE", "TZID:Asia/Ho_Chi_Minh", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0700", "TZOFFSETTO:+0700", "TZNAME:ICT", "END:STANDARD", "END:VTIMEZONE"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  for (const event of events) {
    if (!event.startTime || !event.endTime) continue;
    const uid = await sha256(eventIdentity(event));
    const start = `${event.date.replace(/-/g, "")}T${event.startTime.replace(":", "")}00`;
    const end = `${event.date.replace(/-/g, "")}T${event.endTime.replace(":", "")}00`;
    lines.push("BEGIN:VEVENT", `UID:${uid}@utc-calendar-exporter.local`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Ho_Chi_Minh:${start}`, `DTEND;TZID=Asia/Ho_Chi_Minh:${end}`, `SUMMARY:${escapeIcs(eventTitle(event))}`, `DESCRIPTION:${escapeIcs(eventDescription(event))}`, `LOCATION:${escapeIcs(event.room ?? "")}`, `CLASS:${privateEvents ? "PRIVATE" : "PUBLIC"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcs).join("\r\n")}\r\n`;
}

import { academicCalendarEventSchema, type AcademicCalendarEvent, type RawAcademicEvent } from "../../models/academic-calendar-event.js";
import { classifyAcademicEvent } from "../../classification/classify-academic-event.js";
import { parseTime, parseVietnameseDate } from "../../utils/date.js";
import { cleanOptional, normalizeWhitespace } from "../../utils/text.js";

const LABEL_LINE = /^(mã lớp|mã học phần|lớp|nhóm|phòng|địa điểm|tiết|hình thức|ghi chú|ca thi|thời lượng|số báo danh|ngày|thứ|giờ)\s*:/i;

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanOptional(match[1]);
  }
  return undefined;
}

function pickSubject(raw: RawAcademicEvent): string | undefined {
  if (raw.subject) return cleanOptional(raw.subject.replace(/^\[(THI|HỌC VỤ|CHƯA PHÂN LOẠI)\]\s*/iu, ""));
  const lines = normalizeWhitespace(raw.rawText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => !LABEL_LINE.test(line) && !/^\d{1,2}[:h]\d{2}/i.test(line));
}

export function parseRawEvent(raw: RawAcademicEvent, referenceYear = new Date().getFullYear()): AcademicCalendarEvent | undefined {
  const text = normalizeWhitespace(raw.rawText ?? "");
  const subject = pickSubject(raw);
  const date = raw.date ?? firstMatch(text, [/(?:ngày|thứ[^:\n]*)\s*[:,-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i, /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/]);
  const parsedDate = date ? parseVietnameseDate(date, referenceYear) ?? date : undefined;
  if (!subject || !parsedDate || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) return undefined;

  const timeRange = text.match(/(\d{1,2}[:h.]\d{2})\s*(?:-|–|—|đến)\s*(\d{1,2}[:h.]\d{2})/i);
  const periodRange = text.match(/(?:tiết|tiet)\s*[: ]\s*(\d{1,2})\s*(?:-|–|đến)\s*(\d{1,2})/i);
  const classification = classifyAcademicEvent(raw);

  const candidate = {
    eventType: classification.eventType,
    sourcePage: raw.sourcePage,
    sourceExtractor: raw.sourceExtractor,
    sources: [raw.sourcePage],
    subject,
    classCode: raw.classCode ?? firstMatch(text, [/(?:mã lớp|mã học phần|lớp)\s*:\s*([^\n]+)/i]),
    group: raw.group ?? firstMatch(text, [/(?:nhóm)\s*:\s*([^\n]+)/i]),
    date: parsedDate,
    startTime: raw.startTime ?? (timeRange?.[1] ? parseTime(timeRange[1]) : undefined),
    endTime: raw.endTime ?? (timeRange?.[2] ? parseTime(timeRange[2]) : undefined),
    startPeriod: raw.startPeriod ?? (periodRange?.[1] ? Number(periodRange[1]) : undefined),
    endPeriod: raw.endPeriod ?? (periodRange?.[2] ? Number(periodRange[2]) : undefined),
    room: raw.room ?? firstMatch(text, [/(?:phòng(?: thi)?|phong(?: thi)?)\s*:\s*([^\n]+)/i]),
    location: raw.location,
    instructor: raw.instructor,
    studyMode: raw.studyMode ?? firstMatch(text, [/(?:hình thức(?: học)?|hinh thuc(?: hoc)?)\s*:\s*([^\n]+)/i]),
    examSession: raw.examSession ?? firstMatch(text, [/(?:ca thi)\s*:\s*([^\n]+)/i]),
    examFormat: raw.examFormat ?? firstMatch(text, [/(?:hình thức thi|hinh thuc thi)\s*:\s*([^\n]+)/i]),
    durationMinutes: raw.durationMinutes ?? (() => {
      const match = text.match(/(?:thời lượng|thoi luong)\s*:\s*(\d{1,3})/i);
      return match?.[1] ? Number(match[1]) : undefined;
    })(),
    studentNumber: raw.studentNumber ?? firstMatch(text, [/(?:số báo danh|so bao danh)\s*:\s*([^\n]+)/i]),
    note: raw.note ?? firstMatch(text, [/(?:ghi chú|ghi chu)\s*:\s*([^\n]+)/i]),
    rawText: text || undefined,
    sourceWeek: raw.sourceWeek,
    classification: classification.classification,
    classificationConfidence: classification.confidence,
    classificationReasons: classification.reasons,
  };

  const result = academicCalendarEventSchema.safeParse(candidate);
  return result.success ? result.data : undefined;
}

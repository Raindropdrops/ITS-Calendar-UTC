import type { CalendarEventType, RawAcademicEvent } from "../models/academic-calendar-event.js";
import { comparableSignalText, examSignals, otherSignals } from "./event-signals.js";

export type ClassificationResult = {
  eventType: CalendarEventType;
  confidence: number;
  classification: "explicit" | "inferred" | "unknown";
  reasons: string[];
};

export function classifyAcademicEvent(raw: RawAcademicEvent): ClassificationResult {
  const backendEntries = Object.entries(raw.backendFields ?? {});
  const explicitIsExam = backendEntries.some(
    ([key, value]) => /^(isExam|laLichThi)$/i.test(key) && (value === true || value === 1 || String(value).toLowerCase() === "true"),
  );
  const explicitExamType = backendEntries.some(
    ([key, value]) => /^(eventType|scheduleType|loaiLich|loaiSuKien|phanLoai)$/i.test(key) && /^(exam|thi|lịch thi|lichtHi)$/i.test(String(value).replace(/[_\s-]/g, "")),
  );
  if (explicitIsExam || explicitExamType) {
    return {
      eventType: "exam",
      confidence: 1,
      classification: "explicit",
      reasons: [explicitIsExam ? "Backend đánh dấu isExam" : "Backend ghi rõ loại lịch thi"],
    };
  }
  const backend = raw.backendFields ? JSON.stringify(raw.backendFields) : "";
  const text = comparableSignalText([raw.subject, raw.rawText, raw.note, backend].filter(Boolean).join("\n"));
  let examScore = 0;
  const examReasons: string[] = [];

  for (const signal of examSignals) {
    if (signal.pattern.test(text)) {
      examScore += signal.score;
      examReasons.push(signal.reason);
    }
  }

  if (examScore >= 70) {
    return {
      eventType: "exam",
      confidence: Math.min(1, examScore / 100),
      classification: examScore >= 100 ? "explicit" : "inferred",
      reasons: examReasons,
    };
  }

  let otherScore = 0;
  const otherReasons: string[] = [];
  for (const signal of otherSignals) {
    if (signal.pattern.test(text)) {
      otherScore += signal.score;
      otherReasons.push(signal.reason);
    }
  }
  if (otherScore >= 50) {
    return { eventType: "other", confidence: 0.7, classification: "inferred", reasons: otherReasons };
  }

  const studySignals = [raw.startPeriod, raw.endPeriod, raw.studyMode].filter(Boolean).length;
  if (studySignals > 0 || /\b(tiet|ly thuyet|thuc hanh)\b/i.test(text)) {
    return {
      eventType: "study",
      confidence: studySignals >= 2 ? 0.9 : 0.72,
      classification: "inferred",
      reasons: ["Có cấu trúc buổi học (tiết hoặc hình thức học)"],
    };
  }

  return {
    eventType: "unknown",
    confidence: 0,
    classification: "unknown",
    reasons: examReasons.length > 0 ? ["Có tín hiệu thi nhưng chưa đủ chắc chắn", ...examReasons] : [],
  };
}

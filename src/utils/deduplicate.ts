import { createHash } from "node:crypto";
import type { AcademicCalendarEvent } from "../models/academic-calendar-event.js";
import { normalizeIdentityText, similarity } from "./text.js";

export function eventIdentityKey(event: AcademicCalendarEvent): string {
  const raw = [
    event.eventType,
    event.date,
    event.startTime ?? "",
    event.endTime ?? "",
    normalizeIdentityText(event.subject),
    normalizeIdentityText(event.room ?? event.location),
    normalizeIdentityText(event.classCode),
  ].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function stableEventId(event: AcademicCalendarEvent): string {
  const raw = [
    event.eventType,
    event.date,
    normalizeIdentityText(event.subject),
    normalizeIdentityText(event.classCode),
    normalizeIdentityText(event.group),
    event.startPeriod ?? "",
    normalizeIdentityText(event.examSession),
  ].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function isControlledFuzzyMatch(a: AcademicCalendarEvent, b: AcademicCalendarEvent): boolean {
  if (a.eventType !== b.eventType || a.date !== b.date) return false;
  if (a.startTime && b.startTime) {
    const [ah = 0, am = 0] = a.startTime.split(":").map(Number);
    const [bh = 0, bm = 0] = b.startTime.split(":").map(Number);
    if (Math.abs(ah * 60 + am - (bh * 60 + bm)) > 5) return false;
  }
  const subjectSimilarity = similarity(a.subject, b.subject);
  if (subjectSimilarity < (a.eventType === "exam" ? 0.75 : 0.9)) return false;
  if (a.room && b.room && normalizeIdentityText(a.room) !== normalizeIdentityText(b.room)) return false;
  const sameExtractor = a.sourceExtractor === b.sourceExtractor && a.sourcePage === b.sourcePage;
  if (sameExtractor && a.classCode && b.classCode && normalizeIdentityText(a.classCode) !== normalizeIdentityText(b.classCode)) return false;
  if (a.examSession && b.examSession && normalizeIdentityText(a.examSession) !== normalizeIdentityText(b.examSession)) return false;
  return true;
}

function sourcePriority(event: AcademicCalendarEvent): number {
  const extractor = event.sourceExtractor === "network-json" ? 30 : event.sourceExtractor === "network-html" ? 20 : 10;
  return extractor + (event.sourcePage === "exam-calendar" ? 5 : 0);
}

function mergePair(primary: AcademicCalendarEvent, secondary: AcademicCalendarEvent): AcademicCalendarEvent {
  const prefer = sourcePriority(primary) >= sourcePriority(secondary) ? primary : secondary;
  const fallback = prefer === primary ? secondary : primary;
  return {
    ...fallback,
    ...prefer,
    endTime: prefer.endTime ?? fallback.endTime,
    room: prefer.room ?? fallback.room,
    location: prefer.location ?? fallback.location,
    classCode: prefer.classCode ?? fallback.classCode,
    examFormat: prefer.examFormat ?? fallback.examFormat,
    durationMinutes: prefer.durationMinutes ?? fallback.durationMinutes,
    note: prefer.note ?? fallback.note,
    sources: [...new Set([...primary.sources, ...secondary.sources])],
    rawTexts: [...new Set([...(primary.rawTexts ?? [primary.rawText ?? ""]), ...(secondary.rawTexts ?? [secondary.rawText ?? ""])]).values()].filter(Boolean),
  };
}

export function deduplicateEvents(events: AcademicCalendarEvent[]): {
  events: AcademicCalendarEvent[];
  removed: number;
} {
  const unique: AcademicCalendarEvent[] = [];
  let removed = 0;
  for (const event of events) {
    const exactIndex = unique.findIndex((candidate) => eventIdentityKey(candidate) === eventIdentityKey(event));
    const fuzzyIndex = exactIndex >= 0 ? exactIndex : unique.findIndex((candidate) => isControlledFuzzyMatch(candidate, event));
    if (fuzzyIndex >= 0) {
      unique[fuzzyIndex] = mergePair(unique[fuzzyIndex]!, event);
      removed += 1;
    } else {
      unique.push(event);
    }
  }
  return { events: unique, removed };
}

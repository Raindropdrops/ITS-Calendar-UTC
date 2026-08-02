import { describe, expect, it } from "vitest";
import type { AcademicCalendarEvent } from "../src/models/academic-calendar-event.js";
import { deduplicateEvents, eventIdentityKey } from "../src/utils/deduplicate.js";

const base: AcademicCalendarEvent = {
  eventType: "exam",
  sourcePage: "study-calendar",
  sourceExtractor: "dom",
  sources: ["study-calendar"],
  subject: "Điều khiển Logic - PLC",
  date: "2026-12-20",
  startTime: "13:00",
  endTime: "14:30",
  room: "402-A2",
  classification: "explicit",
  classificationConfidence: 1,
};

describe("deduplication", () => {
  it("has stable exact keys", () => expect(eventIdentityKey(base)).toBe(eventIdentityKey({ ...base })));

  it("merges the same exam from two pages and keeps both sources", () => {
    const other: AcademicCalendarEvent = { ...base, sourcePage: "exam-calendar", sourceExtractor: "network-json", sources: ["exam-calendar"], examFormat: "Tự luận" };
    const result = deduplicateEvents([base, other]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.sources).toEqual(expect.arrayContaining(["study-calendar", "exam-calendar"]));
    expect(result.events[0]?.examFormat).toBe("Tự luận");
  });

  it("keeps same subject when time differs", () => {
    const result = deduplicateEvents([base, { ...base, startTime: "15:00", endTime: "16:30" }]);
    expect(result.events).toHaveLength(2);
  });

  it("merges the same study event from backend state and DOM despite different class labels", () => {
    const studyBackend: AcademicCalendarEvent = { ...base, eventType: "study", sourceExtractor: "network-json", classCode: "EE0.001.3", classification: "inferred" };
    const studyDom: AcademicCalendarEvent = { ...studyBackend, sourceExtractor: "dom", classCode: "Tên lớp hiển thị-1-26(N01)" };
    const result = deduplicateEvents([studyBackend, studyDom]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.sourceExtractor).toBe("network-json");
    expect(result.events[0]?.classCode).toBe("EE0.001.3");
  });
});

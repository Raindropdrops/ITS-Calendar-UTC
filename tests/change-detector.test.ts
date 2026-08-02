import { describe, expect, it } from "vitest";
import type { AcademicCalendarEvent } from "../src/models/academic-calendar-event.js";
import { compareSnapshots, type ScheduleSnapshot } from "../src/snapshots/change-detector.js";

const event: AcademicCalendarEvent = {
  eventType: "study",
  sourcePage: "study-calendar",
  sourceExtractor: "dom",
  sources: ["study-calendar"],
  subject: "Môn A",
  date: "2026-08-12",
  startTime: "07:00",
  endTime: "09:25",
  room: "A1",
  classification: "inferred",
  classificationConfidence: 0.9,
};

describe("safe change detection", () => {
  it("does not mark removal when its week was not loaded successfully", () => {
    const previous: ScheduleSnapshot = { createdAt: "old", events: [event], successfulWeeks: [] };
    const current: ScheduleSnapshot = { createdAt: "new", events: [], successfulWeeks: [] };
    const report = compareSnapshots(previous, current);
    expect(report.removed).toHaveLength(0);
    expect(report.unknownBecauseWeekFailed).toHaveLength(1);
  });

  it("detects a time or room update as changed", () => {
    const previous: ScheduleSnapshot = { createdAt: "old", events: [event], successfulWeeks: [{ start: "2026-08-10", end: "2026-08-16", label: "week" }] };
    const updated = { ...event, startTime: "08:00", endTime: "10:25", room: "A2" };
    const current: ScheduleSnapshot = { createdAt: "new", events: [updated], successfulWeeks: previous.successfulWeeks };
    const report = compareSnapshots(previous, current);
    expect(report.changed).toHaveLength(1);
    expect(report.added).toHaveLength(0);
    expect(report.removed).toHaveLength(0);
  });
});

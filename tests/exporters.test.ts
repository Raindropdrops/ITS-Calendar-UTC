import { describe, expect, it } from "vitest";
import type { AcademicCalendarEvent } from "../src/models/academic-calendar-event.js";
import { csvEscape, toGoogleCsv } from "../src/exporters/google-csv-exporter.js";
import { escapeIcsText, foldIcsLine, toIcs } from "../src/exporters/ics-exporter.js";

const event: AcademicCalendarEvent = {
  eventType: "study",
  sourcePage: "study-calendar",
  sourceExtractor: "dom",
  sources: ["study-calendar"],
  subject: "Cơ khí, ô tô",
  date: "2026-08-12",
  startTime: "07:00",
  endTime: "09:25",
  room: "402-A2",
  note: "Mang tài liệu\nBản in",
  classification: "inferred",
  classificationConfidence: 0.9,
};

describe("calendar exporters", () => {
  it("escapes CSV commas, quotes and newlines", () => {
    expect(csvEscape('A, "B"\nC')).toBe('"A, ""B""\nC"');
    expect(toGoogleCsv([event], true).content).toContain('"Cơ khí, ô tô"');
  });

  it("escapes and folds ICS", () => {
    expect(escapeIcsText("A,B;C\nD")).toBe("A\\,B\\;C\\nD");
    expect(foldIcsLine(`DESCRIPTION:${"á".repeat(80)}`)).toContain("\r\n ");
    expect(foldIcsLine(`DESCRIPTION:${"á".repeat(120)}`).split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
    const ics = toIcs([event], true).content;
    expect(ics).toContain("TZID:Asia/Ho_Chi_Minh");
    expect(ics).toContain("CLASS:PRIVATE");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("does not invent times for untimed events", () => {
    const result = toIcs([{ ...event, endTime: undefined }], true);
    expect(result.skipped).toBe(1);
    expect(result.content).not.toContain("BEGIN:VEVENT");
  });
});

import { describe, expect, it } from "vitest";
import { classifyAcademicEvent } from "../src/classification/classify-academic-event.js";

describe("academic event classification", () => {
  it("recognizes an explicit backend exam", () => {
    const result = classifyAcademicEvent({
      sourcePage: "study-calendar",
      sourceExtractor: "network-json",
      subject: "Điều khiển Logic - PLC",
      backendFields: { isExam: true, caThi: "Ca 2" },
    });
    expect(result.eventType).toBe("exam");
    expect(result.classification).toBe("explicit");
  });

  it("does not call an event exam only because it is late in semester", () => {
    const result = classifyAcademicEvent({
      sourcePage: "study-calendar",
      sourceExtractor: "dom",
      subject: "Điều khiển Logic",
      date: "2027-01-10",
    });
    expect(result.eventType).toBe("unknown");
  });
});

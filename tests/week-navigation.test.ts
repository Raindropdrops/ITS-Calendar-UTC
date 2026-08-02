import { describe, expect, it } from "vitest";
import { shiftWeekDate } from "../src/browser/wait-for-schedule.js";

describe("week navigation across calendar boundaries", () => {
  it("moves across a month boundary", () => {
    expect(shiftWeekDate("31/08/2026", "next")).toBe("07/09/2026");
    expect(shiftWeekDate("07/09/2026", "previous")).toBe("31/08/2026");
  });

  it("moves across a year boundary", () => {
    expect(shiftWeekDate("28/12/2026", "next")).toBe("04/01/2027");
  });
});

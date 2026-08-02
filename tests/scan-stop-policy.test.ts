import { describe, expect, it } from "vitest";
import type { WeekScanResult } from "../src/models/academic-calendar-event.js";
import { isWeekAcademicallyEmpty, shouldStopScan } from "../src/scanner/scan-stop-policy.js";

const emptyWeek = (start: string, end: string): WeekScanResult => ({
  weekStart: start,
  weekEnd: end,
  weekLabel: `${start} - ${end}`,
  loadedSuccessfully: true,
  events: [],
  coursesWithoutDetail: [],
});

describe("automatic semester stop policy", () => {
  it("does not treat an internship date range as an empty week", () => {
    const internshipWeek = emptyWeek("2026-09-07", "2026-09-13");
    internshipWeek.coursesWithoutDetail.push({
      subject: "Thực tập điện tử",
      startDate: "2026-09-07",
      endDate: "2026-09-20",
    });
    expect(isWeekAcademicallyEmpty(internshipWeek)).toBe(false);
  });

  it("stops at the grace horizon when four empty weeks already occurred inside it", () => {
    const horizonWeek = emptyWeek("2027-01-11", "2027-01-17");
    expect(shouldStopScan({ mode: "auto-semester", includeUnknown: false, privateEvents: true, saveRawJson: true, scanExamPage: true }, 25, horizonWeek, "2026-11-22", 8)).toBe(true);
  });

  it("does not stop before the grace horizon", () => {
    const earlyWeek = emptyWeek("2026-12-14", "2026-12-20");
    expect(shouldStopScan({ mode: "auto-semester", includeUnknown: false, privateEvents: true, saveRawJson: true, scanExamPage: true }, 21, earlyWeek, "2026-11-22", 4)).toBe(false);
  });
});

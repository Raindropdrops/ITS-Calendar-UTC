import { describe, expect, it } from "vitest";
import { parseTime, parseVietnameseDate, toGoogleTime } from "../src/utils/date.js";

describe("date utilities", () => {
  it("parses 24-hour times", () => {
    expect(parseTime("07:00")).toBe("07:00");
    expect(parseTime("13h05")).toBe("13:05");
    expect(parseTime("15.35")).toBe("15:35");
  });

  it("formats Google Calendar AM/PM time", () => {
    expect(toGoogleTime("07:00")).toBe("07:00 AM");
    expect(toGoogleTime("15:35")).toBe("03:35 PM");
  });

  it("parses dates across months and years", () => {
    expect(parseVietnameseDate("31/12/2026")).toBe("2026-12-31");
    expect(parseVietnameseDate("01/01/2027")).toBe("2027-01-01");
  });
});

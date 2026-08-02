import { describe, expect, it } from "vitest";
import { parseRawEvent } from "../src/adapters/utc/parsers.js";

describe("UTC card parser", () => {
  it("parses a multiline study card", () => {
    const event = parseRawEvent({
      sourcePage: "study-calendar",
      sourceExtractor: "dom",
      rawText: "  Phương tiện giao thông đường bộ \n Ngày: 12/08/2026 \n 07:00 – 09:25 \n Tiết: 1-3 \n Mã lớp: ME0.801 \n Phòng: 402-A2 \n Hình thức học: Lý thuyết ",
    });
    expect(event).toMatchObject({
      eventType: "study",
      subject: "Phương tiện giao thông đường bộ",
      date: "2026-08-12",
      startTime: "07:00",
      endTime: "09:25",
      startPeriod: 1,
      endPeriod: 3,
      room: "402-A2",
    });
  });

  it("keeps unknown cards in normalized data", () => {
    const event = parseRawEvent({
      sourcePage: "study-calendar",
      sourceExtractor: "dom",
      rawText: "Thông báo học vụ\nNgày: 13/08/2026\n13:00 - 14:00",
    });
    expect(event?.eventType).toBe("unknown");
  });
});

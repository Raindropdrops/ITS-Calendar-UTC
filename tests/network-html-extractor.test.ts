import { describe, expect, it } from "vitest";
import { extractEventsFromNetworkHtml } from "../src/adapters/utc/network-extractor.js";

describe("network HTML fallback", () => {
  it("parses a schedule card from an HTML fragment", () => {
    const events = extractEventsFromNetworkHtml([
      {
        timestamp: "2026-08-01T00:00:00Z",
        method: "GET",
        url: "https://qldt.utc.edu.vn/example",
        resourceType: "xhr",
        contentType: "text/html",
        responseBody: '<div data-date="2026-08-12"><div class="fc-event">Cơ học máy\n07:00 - 09:25\nTiết: 1-3\nPhòng: A1</div></div>',
      },
    ], "study-calendar", "10/08/2026 - 16/08/2026");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ subject: "Cơ học máy", date: "2026-08-12", sourceExtractor: "network-html" });
  });
});

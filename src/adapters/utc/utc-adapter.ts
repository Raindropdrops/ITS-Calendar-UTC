import type { Page } from "playwright";
import type { SourcePage, WeekScanResult } from "../../models/academic-calendar-event.js";
import type { NetworkRecorder } from "../../discovery/network-recorder.js";
import { parseVietnameseDate } from "../../utils/date.js";
import { deduplicateEvents } from "../../utils/deduplicate.js";
import { readWeekIdentity, waitForScheduleStable } from "../../browser/wait-for-schedule.js";
import { extractCoursesWithoutDetail } from "./course-without-detail-extractor.js";
import { extractEventsFromDom } from "./dom-extractor.js";
import { extractEventsFromNetworkHtml, extractEventsFromNetworkRecords } from "./network-extractor.js";
import { extractEventsFromPageState } from "./page-state-extractor.js";

function weekBounds(weekLabel: string, dates: string[]): { weekStart?: string; weekEnd?: string } {
  const labelDates = [...weekLabel.matchAll(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/g)]
    .map((match) => parseVietnameseDate(match[1]!))
    .filter((date): date is string => Boolean(date));
  const all = [...labelDates, ...dates].sort();
  return { weekStart: all[0], weekEnd: all.at(-1) };
}

export class UtcAdapter {
  private recordCursor = 0;

  constructor(
    private readonly page: Page,
    private readonly recorder: NetworkRecorder,
    private readonly sourcePage: SourcePage,
  ) {}

  async scanCurrentWeek(): Promise<WeekScanResult> {
    try {
      if (this.sourcePage === "study-calendar") {
        const calendarReady = await this.page.locator("#datebody").first().isVisible().catch(() => false);
        const activeWeek = await this.page.locator("[batdau][ketthuc].active").first().isVisible().catch(() => false);
        if (!calendarReady || !activeWeek) throw new Error("Không tìm thấy lưới lịch hoặc tuần đang chọn.");
      }
      const weekLabel = await waitForScheduleStable(this.page);
      const recentRecords = this.recorder.records.slice(this.recordCursor);
      this.recordCursor = this.recorder.records.length;
      const pageStateEvents = this.sourcePage === "study-calendar" ? await extractEventsFromPageState(this.page, weekLabel) : [];
      const networkEvents = extractEventsFromNetworkRecords(recentRecords, this.sourcePage, weekLabel);
      const networkHtmlEvents = extractEventsFromNetworkHtml(recentRecords, this.sourcePage, weekLabel);
      const domEvents = await extractEventsFromDom(this.page, this.sourcePage, weekLabel);
      const events = deduplicateEvents([...pageStateEvents, ...networkEvents, ...networkHtmlEvents, ...domEvents]).events;
      if (this.sourcePage === "study-calendar") await this.page.waitForTimeout(500);
      const coursesWithoutDetail = await extractCoursesWithoutDetail(this.page);
      const bounds = weekBounds(weekLabel, events.map((event) => event.date));
      return {
        weekLabel,
        weekStart: bounds.weekStart,
        weekEnd: bounds.weekEnd,
        loadedSuccessfully: true,
        events,
        coursesWithoutDetail,
        extractor: pageStateEvents.length > 0 || networkEvents.length > 0 ? "network-json" : networkHtmlEvents.length > 0 ? "network-html" : "dom",
      };
    } catch (error) {
      return {
        weekLabel: await readWeekIdentity(this.page).catch(() => "Không xác định"),
        loadedSuccessfully: false,
        events: [],
        coursesWithoutDetail: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

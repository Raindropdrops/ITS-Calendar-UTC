import fs from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import type { Page } from "playwright";
import { UtcAdapter } from "../adapters/utc/utc-adapter.js";
import { clickWeekDirection, readWeekIdentity, waitForScheduleStable } from "../browser/wait-for-schedule.js";
import { FAILURE_DIR, scanDefaults, TIME_ZONE, type ScanOptions } from "../config.js";
import type { AcademicCalendarEvent, CourseWithoutDetail, WeekScanResult } from "../models/academic-calendar-event.js";
import type { NetworkRecorder } from "../discovery/network-recorder.js";
import { compareIsoDates, timestampForFilename } from "../utils/date.js";
import { deduplicateEvents } from "../utils/deduplicate.js";
import { ensureDir } from "../utils/filesystem.js";
import { logger } from "../utils/logger.js";
import { isAfterLatestKnownDate, isWeekAcademicallyEmpty, shouldStopScan } from "./scan-stop-policy.js";

export type SemesterScan = {
  events: AcademicCalendarEvent[];
  rawEvents: AcademicCalendarEvent[];
  coursesWithoutDetail: CourseWithoutDetail[];
  weeks: WeekScanResult[];
  duplicatesRemoved: number;
  latestKnownDate?: string;
};

function dateExtremes(result: WeekScanResult): { earliest?: string; latest?: string } {
  const dates = [
    ...result.events.map((event) => event.date),
    ...result.coursesWithoutDetail.flatMap((course) => [course.startDate, course.endDate].filter((date): date is string => Boolean(date))),
  ].sort();
  return { earliest: dates[0], latest: dates.at(-1) };
}

async function saveFailure(page: Page, result: WeekScanResult, attempt: number): Promise<void> {
  const directory = path.join(FAILURE_DIR, `${timestampForFilename()}-attempt-${attempt}`);
  await ensureDir(directory);
  await page.screenshot({ path: path.join(directory, "screenshot.png"), fullPage: true }).catch(() => undefined);
  await fs.writeFile(path.join(directory, "page.html"), await page.content().catch(() => ""), "utf8");
  await fs.writeFile(path.join(directory, "error.txt"), `${result.weekLabel}\n${result.error ?? "Không rõ lỗi"}\n`, "utf8");
}

async function scanWithRetry(adapter: UtcAdapter, page: Page): Promise<WeekScanResult> {
  let result = await adapter.scanCurrentWeek();
  for (let attempt = 1; !result.loadedSuccessfully && attempt <= scanDefaults.retryCount; attempt += 1) {
    await saveFailure(page, result, attempt);
    logger.warn(`Tuần ${result.weekLabel} tải lỗi, thử lại ${attempt}/${scanDefaults.retryCount}.`);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    result = await adapter.scanCurrentWeek();
  }
  return result;
}

async function moveWeek(page: Page, direction: "next" | "previous"): Promise<void> {
  const previous = await readWeekIdentity(page);
  await clickWeekDirection(page, direction);
  await waitForScheduleStable(page, previous);
  await page.waitForTimeout(scanDefaults.betweenWeeksDelayMs);
}

async function rewindToEarliestKnown(page: Page, earliest: string | undefined, currentWeekStart: string | undefined): Promise<void> {
  if (!earliest || !currentWeekStart || earliest >= currentWeekStart) return;
  const start = DateTime.fromISO(currentWeekStart, { zone: TIME_ZONE });
  const target = DateTime.fromISO(earliest, { zone: TIME_ZONE }).startOf("week");
  const weeks = Math.min(26, Math.ceil(start.diff(target, "weeks").weeks));
  if (weeks <= 0) return;
  logger.info(`Đang lùi ${weeks} tuần để lấy từ đầu phạm vi học kỳ đã nhận diện...`);
  for (let index = 0; index < weeks; index += 1) await moveWeek(page, "previous");
}

export async function scanSemester(page: Page, recorder: NetworkRecorder, options: ScanOptions): Promise<SemesterScan> {
  const adapter = new UtcAdapter(page, recorder, "study-calendar");
  const initial = await scanWithRetry(adapter, page);
  const initialExtremes = dateExtremes(initial);
  await rewindToEarliestKnown(page, initialExtremes.earliest, initial.weekStart);

  const weeks: WeekScanResult[] = [];
  const rawEvents: AcademicCalendarEvent[] = [];
  const courses: CourseWithoutDetail[] = [];
  let latestKnownDate = initialExtremes.latest;
  let consecutiveEmptyWeeksAfterLatest = 0;
  let scannedWeeks = 0;
  const visitedWeeks = new Set<string>();

  while (true) {
    const result = scannedWeeks === 0 && (!initialExtremes.earliest || initialExtremes.earliest >= (initial.weekStart ?? ""))
      ? initial
      : await scanWithRetry(adapter, page);
    if (visitedWeeks.has(result.weekLabel)) {
      throw new Error(`Phát hiện tuần bị lặp (${result.weekLabel}); dừng để tránh vòng lặp chuyển lịch nhưng không âm thầm coi là đã quét xong.`);
    }
    visitedWeeks.add(result.weekLabel);
    weeks.push(result);
    scannedWeeks += 1;

    if (result.loadedSuccessfully) {
      rawEvents.push(...result.events);
      courses.push(...result.coursesWithoutDetail);
      const latest = dateExtremes(result).latest;
      if (latest && (!latestKnownDate || compareIsoDates(latest, latestKnownDate) > 0)) {
        latestKnownDate = latest;
        consecutiveEmptyWeeksAfterLatest = 0;
      }
      const canCountEmpty = latestKnownDate
        ? isAfterLatestKnownDate(result, latestKnownDate)
        : scannedWeeks > scanDefaults.minimumForwardWeeks - scanDefaults.consecutiveEmptyWeeksToStop;
      if (canCountEmpty && isWeekAcademicallyEmpty(result)) consecutiveEmptyWeeksAfterLatest += 1;
      else if (!isWeekAcademicallyEmpty(result)) consecutiveEmptyWeeksAfterLatest = 0;
    }

    logger.info(
      `Tuần ${scannedWeeks} | ${result.weekLabel} | sự kiện: ${result.events.length} | ` +
      `khoảng không có giờ chi tiết: ${result.coursesWithoutDetail.length} | mốc xa nhất: ${latestKnownDate ?? "chưa rõ"} | ` +
      `tuần trống sau mốc: ${consecutiveEmptyWeeksAfterLatest}/${scanDefaults.consecutiveEmptyWeeksToStop}`,
    );

    if (shouldStopScan(options, scannedWeeks, result, latestKnownDate, consecutiveEmptyWeeksAfterLatest)) break;
    await moveWeek(page, "next");
  }

  const deduplicated = deduplicateEvents(rawEvents);
  const uniqueCourses = [...new Map(courses.map((course) => [`${course.classCode ?? ""}|${course.subject}|${course.startDate ?? ""}`, course])).values()];
  return {
    events: deduplicated.events,
    rawEvents,
    coursesWithoutDetail: uniqueCourses,
    weeks,
    duplicatesRemoved: deduplicated.removed,
    latestKnownDate,
  };
}

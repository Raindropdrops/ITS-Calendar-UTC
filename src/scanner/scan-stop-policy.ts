import { scanDefaults, type ScanOptions } from "../config.js";
import type { WeekScanResult } from "../models/academic-calendar-event.js";
import { addWeeks } from "../utils/date.js";

export function isWeekAcademicallyEmpty(result: WeekScanResult): boolean {
  return result.events.length === 0 && result.coursesWithoutDetail.length === 0;
}

export function isAfterLatestKnownDate(result: WeekScanResult, latestKnownDate: string | undefined): boolean {
  return Boolean(latestKnownDate && result.weekStart && result.weekStart > latestKnownDate);
}

export function reachedStopHorizon(result: WeekScanResult, latestKnownDate: string | undefined): boolean {
  if (!latestKnownDate) return false;
  const horizon = addWeeks(latestKnownDate, scanDefaults.gracePeriodWeeks);
  return Boolean(result.weekEnd && result.weekEnd >= horizon);
}

export function shouldStopScan(
  options: ScanOptions,
  scannedWeeks: number,
  result: WeekScanResult,
  latestKnownDate: string | undefined,
  consecutiveEmptyWeeksAfterLatest: number,
): boolean {
  if (options.mode === "fixed-weeks") return scannedWeeks >= (options.fixedWeeks ?? 16);
  if (options.mode === "until-date") return Boolean(result.weekEnd && options.untilDate && result.weekEnd >= options.untilDate);

  if (!latestKnownDate) {
    return scannedWeeks >= scanDefaults.minimumForwardWeeks
      && consecutiveEmptyWeeksAfterLatest >= scanDefaults.consecutiveEmptyWeeksToStop;
  }

  return reachedStopHorizon(result, latestKnownDate)
    && consecutiveEmptyWeeksAfterLatest >= scanDefaults.consecutiveEmptyWeeksToStop;
}

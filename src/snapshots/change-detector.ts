import fs from "node:fs/promises";
import path from "node:path";
import type { AcademicCalendarEvent, WeekScanResult } from "../models/academic-calendar-event.js";
import { SNAPSHOT_DIR } from "../config.js";
import { eventIdentityKey, stableEventId } from "../utils/deduplicate.js";
import { pathExists, writeJson } from "../utils/filesystem.js";
import { timestampForFilename } from "../utils/date.js";

export type ScheduleSnapshot = {
  createdAt: string;
  events: AcademicCalendarEvent[];
  successfulWeeks: Array<{ start?: string; end?: string; label: string }>;
};

export type ChangeReport = {
  added: AcademicCalendarEvent[];
  changed: Array<{ before: AcademicCalendarEvent; after: AcademicCalendarEvent }>;
  removed: AcademicCalendarEvent[];
  unchanged: AcademicCalendarEvent[];
  unknownBecauseWeekFailed: AcademicCalendarEvent[];
};

function coveredBySuccessfulWeek(event: AcademicCalendarEvent, weeks: ScheduleSnapshot["successfulWeeks"]): boolean {
  return weeks.some((week) => week.start && week.end && event.date >= week.start && event.date <= week.end);
}

export function compareSnapshots(previous: ScheduleSnapshot | undefined, current: ScheduleSnapshot): ChangeReport {
  if (!previous) return { added: current.events, changed: [], removed: [], unchanged: [], unknownBecauseWeekFailed: [] };
  const currentByStableId = new Map(current.events.map((event) => [stableEventId(event), event]));
  const previousByStableId = new Map(previous.events.map((event) => [stableEventId(event), event]));
  const report: ChangeReport = { added: [], changed: [], removed: [], unchanged: [], unknownBecauseWeekFailed: [] };

  for (const event of current.events) {
    const old = previousByStableId.get(stableEventId(event));
    if (!old) report.added.push(event);
    else if (eventIdentityKey(old) !== eventIdentityKey(event)) report.changed.push({ before: old, after: event });
    else report.unchanged.push(event);
  }
  for (const event of previous.events) {
    if (currentByStableId.has(stableEventId(event))) continue;
    if (coveredBySuccessfulWeek(event, current.successfulWeeks)) report.removed.push(event);
    else report.unknownBecauseWeekFailed.push(event);
  }
  return report;
}

export async function loadLatestSnapshot(): Promise<ScheduleSnapshot | undefined> {
  const file = path.join(SNAPSHOT_DIR, "latest.json");
  if (!(await pathExists(file))) return undefined;
  return JSON.parse(await fs.readFile(file, "utf8")) as ScheduleSnapshot;
}

export async function saveSnapshot(events: AcademicCalendarEvent[], weeks: WeekScanResult[]): Promise<ScheduleSnapshot> {
  const snapshot: ScheduleSnapshot = {
    createdAt: new Date().toISOString(),
    events,
    successfulWeeks: weeks.filter((week) => week.loadedSuccessfully).map((week) => ({ start: week.weekStart, end: week.weekEnd, label: week.weekLabel })),
  };
  await writeJson(path.join(SNAPSHOT_DIR, `${timestampForFilename()}.json`), snapshot);
  await writeJson(path.join(SNAPSHOT_DIR, "latest.json"), snapshot);
  return snapshot;
}

export function changeReportMarkdown(report: ChangeReport): string {
  return [
    "# Thay đổi lịch UTC",
    "",
    `- Mới: ${report.added.length}`,
    `- Thay đổi: ${report.changed.length}`,
    `- Không còn xuất hiện (tuần tải thành công): ${report.removed.length}`,
    `- Không đổi: ${report.unchanged.length}`,
    `- Chưa thể kết luận do thiếu tuần tải thành công: ${report.unknownBecauseWeekFailed.length}`,
    "",
  ].join("\n");
}

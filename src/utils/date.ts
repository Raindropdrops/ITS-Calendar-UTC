import { DateTime } from "luxon";
import { TIME_ZONE } from "../config.js";

const DATE_FORMATS = ["d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "yyyy-MM-dd"];

export function parseVietnameseDate(value: string, referenceYear?: number): string | undefined {
  const clean = value.trim();
  for (const format of DATE_FORMATS) {
    const parsed = DateTime.fromFormat(clean, format, { zone: TIME_ZONE, locale: "vi" });
    if (parsed.isValid) return parsed.toISODate() ?? undefined;
  }
  const short = DateTime.fromFormat(clean, "d/M", { zone: TIME_ZONE, locale: "vi" });
  if (short.isValid && referenceYear) {
    return short.set({ year: referenceYear }).toISODate() ?? undefined;
  }
  return undefined;
}

export function parseTime(value: string): string | undefined {
  const match = value.trim().match(/(?:^|\D)([01]?\d|2[0-3])[:h.]([0-5]\d)(?:\D|$)/i);
  if (!match) return undefined;
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

export function toGoogleDate(isoDate: string): string {
  return DateTime.fromISO(isoDate, { zone: TIME_ZONE }).toFormat("MM/dd/yyyy");
}

export function toGoogleTime(time: string): string {
  return DateTime.fromFormat(time, "HH:mm", { zone: TIME_ZONE }).toFormat("hh:mm a");
}

export function startOfWeek(isoDate: string): string {
  return DateTime.fromISO(isoDate, { zone: TIME_ZONE }).startOf("week").toISODate()!;
}

export function addWeeks(isoDate: string, weeks: number): string {
  return DateTime.fromISO(isoDate, { zone: TIME_ZONE }).plus({ weeks }).toISODate()!;
}

export function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function timestampForFilename(): string {
  return DateTime.now().setZone(TIME_ZONE).toFormat("yyyy-MM-dd'T'HH-mm-ss");
}

export function nowIso(): string {
  return DateTime.now().setZone(TIME_ZONE).toISO()!;
}

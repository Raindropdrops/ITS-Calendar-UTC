import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { DateTime } from "luxon";
import { scanDefaults } from "../config.js";
import { selectors } from "../adapters/utc/selectors.js";

async function firstVisibleText(page: Page, candidates: readonly string[]): Promise<string | undefined> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      const text = (await locator.innerText().catch(() => "")).trim();
      if (text) return text;
    }
  }
  return undefined;
}

async function scheduleHash(page: Page): Promise<string> {
  let text = "";
  for (const selector of selectors.scheduleRegions) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      text = await locator.innerText().catch(() => "");
      break;
    }
  }
  if (!text) text = await page.locator("body").innerText().catch(() => "");
  return createHash("sha1").update(text).digest("hex");
}

export async function readWeekIdentity(page: Page): Promise<string> {
  const active = page.locator(".my-calendar [batdau][ketthuc].active, [batdau][ketthuc].active").first();
  if (await active.isVisible().catch(() => false)) {
    const start = await active.getAttribute("batdau");
    const end = await active.getAttribute("ketthuc");
    if (start && end) return `${start} - ${end}`;
  }
  const headerDates = await page.locator("#date-header .day-of-week[title]").evaluateAll((elements) => elements.map((element) => element.getAttribute("title")).filter(Boolean)).catch(() => [] as string[]);
  if (headerDates.length > 0) return `${headerDates[0]} - ${headerDates.at(-1)}`;
  return (await firstVisibleText(page, selectors.weekLabels)) ?? `dom:${await scheduleHash(page)}`;
}

export async function waitForScheduleStable(page: Page, previousWeek?: string): Promise<string> {
  const started = Date.now();
  let lastHash = "";
  let unchangedSince = Date.now();
  while (Date.now() - started < scanDefaults.scheduleTimeoutMs) {
    const week = await readWeekIdentity(page);
    const hash = await scheduleHash(page);
    if (hash !== lastHash) {
      lastHash = hash;
      unchangedSince = Date.now();
    }
    const weekChanged = !previousWeek || week !== previousWeek;
    if (weekChanged && Date.now() - unchangedSince >= scanDefaults.stableForMs) return week;
    await page.waitForTimeout(200);
  }
  throw new Error(`Lịch không ổn định hoặc tuần không thay đổi sau ${scanDefaults.scheduleTimeoutMs / 1000} giây.`);
}

export function shiftWeekDate(value: string, direction: "next" | "previous"): string | undefined {
  const parsed = DateTime.fromFormat(value, "dd/MM/yyyy");
  if (!parsed.isValid) return undefined;
  return parsed.plus({ weeks: direction === "next" ? 1 : -1 }).toFormat("dd/MM/yyyy");
}

export async function clickWeekDirection(page: Page, direction: "next" | "previous"): Promise<void> {
  const current = page.locator(".my-calendar [batdau][ketthuc].active, [batdau][ketthuc].active").first();
  const start = await current.getAttribute("batdau").catch(() => null);
  if (start) {
    const target = shiftWeekDate(start, direction);
    if (target) {
      let targetDay = page.locator(`[batdau="${target}"]`).first();
      if (!(await targetDay.isVisible().catch(() => false))) {
        const monthButton = page.locator(direction === "next" ? ".my-calendar .month .next" : ".my-calendar .month .prev").first();
        if (await monthButton.isVisible().catch(() => false)) {
          await monthButton.click();
          await page.waitForTimeout(300);
          targetDay = page.locator(`[batdau="${target}"]`).first();
        }
      }
      if (await targetDay.isVisible().catch(() => false)) {
        await targetDay.click();
        return;
      }
    }
  }
  const candidates = direction === "next" ? selectors.nextWeek : selectors.previousWeek;
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return;
    }
  }
  throw new Error(`Không tìm thấy nút chuyển tuần ${direction === "next" ? "tiếp theo" : "trước đó"}. Hãy chạy discover.`);
}

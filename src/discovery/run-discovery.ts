import fs from "node:fs/promises";
import path from "node:path";
import { input } from "@inquirer/prompts";
import type { Page } from "playwright";
import { createBrowserSession } from "../browser/create-browser.js";
import { ensureAuthenticated } from "../browser/auth.js";
import { openExamCalendar, openStudyCalendar } from "../browser/navigation.js";
import { DISCOVERY_DIR } from "../config.js";
import { selectors } from "../adapters/utc/selectors.js";
import { ensureDir, writeJson } from "../utils/filesystem.js";
import { logger } from "../utils/logger.js";
import { analyzeCandidates } from "./candidate-analyzer.js";
import { createDiscoveryReport } from "./discovery-report.js";
import { NetworkRecorder } from "./network-recorder.js";
import { sanitizeHtmlFixture } from "./sanitize-html-fixture.js";

async function scheduleRegionHtml(page: Page): Promise<string> {
  for (const selector of selectors.scheduleRegions) {
    const region = page.locator(selector).first();
    if (await region.isVisible().catch(() => false)) return region.evaluate((element) => element.outerHTML);
  }
  return "<!-- Không tự nhận diện được vùng lịch; xem page.html. -->";
}

async function safeGlobalSummary(page: Page): Promise<Array<{ name: string; type: string; preview?: string }>> {
  return page.evaluate(() => {
    const sensitive = /(token|cookie|password|passwd|secret|auth|session|csrf)/i;
    return Object.keys(window)
      .filter((name) => !sensitive.test(name) && /(lich|schedule|calendar|week|hoc|thi)/i.test(name))
      .slice(0, 100)
      .map((name) => {
        let value: unknown;
        try { value = (window as any)[name]; } catch { value = undefined; }
        const type = typeof value;
        const preview = ["string", "number", "boolean"].includes(type) ? String(value).slice(0, 300) : undefined;
        return { name, type, preview };
      });
  });
}

async function capturePage(page: Page, directory: string, recorder: NetworkRecorder): Promise<void> {
  await ensureDir(directory);
  await page.screenshot({ path: path.join(directory, "screenshot.png"), fullPage: true });
  await fs.writeFile(path.join(directory, "page.html"), await page.content(), "utf8");
  const regionHtml = await scheduleRegionHtml(page);
  await fs.writeFile(path.join(directory, "schedule-region.html"), regionHtml, "utf8");
  await fs.writeFile(path.join(directory, "schedule-region.sanitized.html"), sanitizeHtmlFixture(regionHtml), "utf8");
  await writeJson(path.join(directory, "requests.json"), recorder.records);
  await writeJson(path.join(directory, "safe-globals.json"), await safeGlobalSummary(page));
  const candidates = analyzeCandidates(recorder.records);
  await fs.writeFile(path.join(directory, "report.md"), createDiscoveryReport(candidates, page.url()), "utf8");
}

export async function runDiscovery(): Promise<void> {
  const { context, page } = await createBrowserSession();
  const studyRecorder = new NetworkRecorder();
  studyRecorder.attach(page);
  try {
    await ensureAuthenticated(page);
    await openStudyCalendar(page);
    logger.info("\nHãy chọn một tuần chắc chắn có lịch và thử chuyển tuần một lần trong trình duyệt.");
    await input({ message: "Nhấn Enter khi lịch đã tải xong" });
    await page.waitForTimeout(1_000);
    await capturePage(page, path.join(DISCOVERY_DIR, "study"), studyRecorder);
    logger.success("Đã lưu discovery của trang Lịch học.");

    const examRecorder = new NetworkRecorder();
    examRecorder.attach(page);
    if (await openExamCalendar(page)) {
      await page.waitForTimeout(1_500);
      await capturePage(page, path.join(DISCOVERY_DIR, "exams"), examRecorder);
      logger.success("Đã lưu discovery của trang Lịch thi.");
    } else {
      logger.warn("Chưa tìm thấy menu Lịch thi; thông tin này đã được ghi nhận để hoàn thiện sau.");
    }
    logger.success(`Artifacts nằm tại ${DISCOVERY_DIR}`);
  } finally {
    await context.close();
  }
}

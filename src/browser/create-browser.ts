import { chromium, type BrowserContext, type Page } from "playwright";
import { PROFILE_DIR } from "../config.js";
import { ensureDir } from "../utils/filesystem.js";

export type BrowserSession = { context: BrowserContext; page: Page };

export async function createBrowserSession(): Promise<BrowserSession> {
  await ensureDir(PROFILE_DIR);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 960 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    acceptDownloads: false,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(20_000);
  return { context, page };
}

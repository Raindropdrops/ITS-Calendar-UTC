import type { Page } from "playwright";
import { UTC_STUDY_URL } from "../config.js";
import { selectors } from "../adapters/utc/selectors.js";

export async function openStudyCalendar(page: Page): Promise<void> {
  if (page.url().includes("Index.aspx#lichhoc")) {
    await page.goto("https://qldt.utc.edu.vn/congthongtin/Index.aspx#dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(750);
  }
  await page.goto(UTC_STUDY_URL, { waitUntil: "domcontentloaded" });
  if (/login\.aspx/i.test(page.url())) throw new Error("Phiên đăng nhập đã hết hạn.");
  await page.locator("[batdau][ketthuc].active").first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {
    throw new Error(`Trang Lịch học chưa tải xong hoặc giao diện đã thay đổi. URL hiện tại: ${page.url()}`);
  });
  await page.locator("#datebody").first().waitFor({ state: "visible", timeout: 10_000 });
}

export async function openExamCalendar(page: Page): Promise<boolean> {
  for (const selector of selectors.examMenu) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await page.locator("#tblLichThiCaNhan, #tblLichThiChung").first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      return true;
    }
  }
  return false;
}

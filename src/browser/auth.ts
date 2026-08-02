import { input } from "@inquirer/prompts";
import type { Page } from "playwright";
import { UTC_LOGIN_URL, UTC_STUDY_URL } from "../config.js";

export async function isAuthenticated(page: Page): Promise<boolean> {
  const loginField = page.locator("input[type='password']").first();
  if (await loginField.isVisible().catch(() => false)) return false;
  return true;
}

export async function ensureAuthenticated(page: Page): Promise<void> {
  await page.goto(UTC_STUDY_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(750);
  if (!/login\.aspx/i.test(page.url()) && await isAuthenticated(page)) return;

  if (!/login\.aspx/i.test(page.url())) {
    await page.goto(UTC_LOGIN_URL, { waitUntil: "domcontentloaded" });
  }

  console.log("\nHãy đăng nhập tài khoản trường trong cửa sổ trình duyệt.");
  console.log("Tool không đọc hoặc lưu mật khẩu. Sau khi vào được hệ thống, quay lại đây.");
  await input({ message: "Nhấn Enter sau khi đăng nhập xong" });

  await page.goto(UTC_STUDY_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(750);
  if (/login\.aspx/i.test(page.url()) || !(await isAuthenticated(page))) {
    throw new Error("Chưa phát hiện phiên đăng nhập. Hãy chạy lại và đăng nhập thành công trước khi xác nhận.");
  }
}

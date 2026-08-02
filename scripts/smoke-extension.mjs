/* global chrome */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = process.cwd();
const extensionPath = path.join(root, "dist", "extension");
const profilePath = process.env.UTC_EXTENSION_SMOKE_PROFILE
  ? path.resolve(root, process.env.UTC_EXTENSION_SMOKE_PROFILE)
  : path.join(root, ".data", "browser-profile-extension-smoke");
const context = await chromium.launchPersistentContext(profilePath, {
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  const qldt = context.pages()[0] ?? await context.newPage();
  await qldt.goto("https://qldt.utc.edu.vn/congthongtin/Index.aspx#lichhoc", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await qldt.waitForTimeout(1_500);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.setViewportSize({ width: 390, height: 650 });
  const health = await popup.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "https://qldt.utc.edu.vn/*" });
    const tab = tabs.find((candidate) => candidate.id);
    if (!tab?.id) return { ok: false, error: "Không tìm thấy tab QLĐT" };
    return chrome.tabs.sendMessage(tab.id, { type: "PING" });
  });
  if (!health?.ok) throw new Error(health?.error ?? "Content script không phản hồi");
  await popup.screenshot({ path: path.join(root, "output", "extension-popup-smoke.png") });
  process.stdout.write(`${JSON.stringify({ extensionId, health, screenshot: "output/extension-popup-smoke.png" }, null, 2)}\n`);
} finally {
  await context.close();
}

#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { confirm, input, number, select } from "@inquirer/prompts";
import { DateTime } from "luxon";
import { PROFILE_DIR, TIME_ZONE, type ScanMode, type ScanOptions } from "./config.js";
import { runDiscovery } from "./discovery/run-discovery.js";
import { runExport } from "./run-export.js";
import { pathExists } from "./utils/filesystem.js";
import { timestampForFilename } from "./utils/date.js";
import { logger } from "./utils/logger.js";

async function promptOptions(): Promise<ScanOptions> {
  const mode = await select<ScanMode>({
    message: "Phạm vi lấy lịch",
    default: "auto-semester",
    choices: [
      { name: "Tự động lấy toàn bộ học kỳ và lịch thi (khuyên dùng)", value: "auto-semester" },
      { name: "Lấy số tuần cụ thể", value: "fixed-weeks" },
      { name: "Lấy đến một ngày cụ thể", value: "until-date" },
    ],
  });
  let fixedWeeks: number | undefined;
  let untilDate: string | undefined;
  if (mode === "fixed-weeks") {
    fixedWeeks = await number({ message: "Số tuần", default: 16, min: 1, required: true });
  }
  if (mode === "until-date") {
    const raw = await input({ message: "Ngày kết thúc (YYYY-MM-DD)", validate: (value) => DateTime.fromISO(value, { zone: TIME_ZONE }).isValid || "Ngày không hợp lệ." });
    untilDate = raw;
  }
  const includeUnknown = process.argv.includes("--include-unknown") || await confirm({ message: "Đưa sự kiện chưa phân loại vào CSV/ICS?", default: false });
  const privateEvents = await confirm({ message: "Đặt sự kiện ở chế độ riêng tư?", default: true });
  const saveRawJson = await confirm({ message: "Lưu raw JSON đã làm sạch?", default: true });
  const scanExamPage = await confirm({ message: "Kiểm tra thêm trang Lịch thi?", default: true });
  return { mode, fixedWeeks, untilDate, includeUnknown, privateEvents, saveRawJson, scanExamPage };
}

async function logout(): Promise<void> {
  if (!(await pathExists(PROFILE_DIR))) {
    logger.info("Chưa có phiên đăng nhập được lưu.");
    return;
  }
  const approved = await confirm({ message: "Đăng xuất bằng cách tách browser profile hiện tại?", default: false });
  if (!approved) return;
  const destination = path.join(path.dirname(PROFILE_DIR), `browser-profile-logged-out-${timestampForFilename()}`);
  await fs.rename(PROFILE_DIR, destination);
  logger.success(`Đã tách phiên cũ sang ${destination}. Lần chạy sau sẽ yêu cầu đăng nhập lại.`);
}

async function main(): Promise<void> {
  let command = process.argv[2];
  if (!command || command.startsWith("--")) {
    command = await select({
      message: "Bạn muốn làm gì?",
      choices: [
        { name: "Xuất toàn bộ lịch học và lịch thi", value: "export" },
        { name: "Chạy discovery để nhận diện website", value: "discover" },
        { name: "Đăng xuất phiên QLĐT đã lưu", value: "logout" },
      ],
    });
  }
  if (command === "discover") await runDiscovery();
  else if (command === "export") await runExport(await promptOptions());
  else if (command === "logout") await logout();
  else throw new Error(`Lệnh không hợp lệ: ${command}`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

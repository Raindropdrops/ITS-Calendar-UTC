import fs from "node:fs/promises";
import path from "node:path";
import { createBrowserSession } from "./browser/create-browser.js";
import { ensureAuthenticated } from "./browser/auth.js";
import { openExamCalendar, openStudyCalendar } from "./browser/navigation.js";
import { UtcAdapter } from "./adapters/utc/utc-adapter.js";
import { NetworkRecorder } from "./discovery/network-recorder.js";
import { OUTPUT_DIR, type ScanOptions } from "./config.js";
import { scanSemester } from "./scanner/semester-scanner.js";
import { deduplicateEvents } from "./utils/deduplicate.js";
import { logger } from "./utils/logger.js";
import { exportAll } from "./exporters/export-all.js";
import { changeReportMarkdown, compareSnapshots, loadLatestSnapshot, saveSnapshot } from "./snapshots/change-detector.js";
import { writeJson } from "./utils/filesystem.js";

export async function runExport(options: ScanOptions): Promise<void> {
  const { context, page } = await createBrowserSession();
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  try {
    await ensureAuthenticated(page);
    await openStudyCalendar(page);
    const studyScan = await scanSemester(page, recorder, options);

    const examEvents = [];
    if (options.scanExamPage) {
      if (await openExamCalendar(page)) {
        await page.waitForTimeout(1_500);
        const examAdapter = new UtcAdapter(page, recorder, "exam-calendar");
        const examResult = await examAdapter.scanCurrentWeek();
        if (examResult.loadedSuccessfully) examEvents.push(...examResult.events);
        else logger.warn(`Trang Lịch thi chưa đọc được: ${examResult.error ?? "không rõ lỗi"}`);
      } else logger.warn("Không tìm thấy menu Lịch thi; vẫn giữ toàn bộ lịch thi đã phát hiện trong trang Lịch học.");
    }

    const merged = deduplicateEvents([...studyScan.events, ...examEvents]);
    const summary = await exportAll(merged.events, [...studyScan.rawEvents, ...examEvents], studyScan.coursesWithoutDetail, options);

    const previous = await loadLatestSnapshot();
    const current = await saveSnapshot(merged.events, studyScan.weeks);
    const changes = compareSnapshots(previous, current);
    await writeJson(path.join(OUTPUT_DIR, "changes.json"), changes);
    await fs.writeFile(path.join(OUTPUT_DIR, "changes.md"), changeReportMarkdown(changes), "utf8");

    const studyCount = merged.events.filter((event) => event.eventType === "study").length;
    const examFromStudy = merged.events.filter((event) => event.eventType === "exam" && event.sources.includes("study-calendar")).length;
    const examFromExam = merged.events.filter((event) => event.eventType === "exam" && event.sources.includes("exam-calendar")).length;
    const examCount = merged.events.filter((event) => event.eventType === "exam").length;
    const otherCount = merged.events.filter((event) => event.eventType === "other").length;
    const unknownCount = merged.events.filter((event) => event.eventType === "unknown").length;
    const successfulWeeks = studyScan.weeks.filter((week) => week.loadedSuccessfully).length;
    const failedWeeks = studyScan.weeks.length - successfulWeeks;

    logger.success("Đã xuất lịch.");
    logger.info(`Tổng số tuần: ${studyScan.weeks.length} | thành công: ${successfulWeeks} | lỗi: ${failedWeeks}`);
    logger.info(`Lịch học: ${studyCount} | lịch thi: ${examCount} (trang Lịch học: ${examFromStudy}, trang Lịch thi: ${examFromExam})`);
    logger.info(`Học vụ khác: ${otherCount} | chưa phân loại: ${unknownCount}`);
    logger.info(`Lớp học phần có khoảng ngày nhưng không có giờ chi tiết: ${studyScan.coursesWithoutDetail.length}`);
    logger.info(`Bản ghi trùng đã gộp: ${studyScan.duplicatesRemoved + merged.removed}`);
    logger.info(`Sự kiện thiếu giờ bắt đầu/kết thúc, chỉ giữ trong JSON: ${summary.skippedUntimed}`);
    logger.info(`Thay đổi: +${changes.added.length} mới, ${changes.changed.length} đổi, ${changes.removed.length} không còn xuất hiện, ${changes.unknownBecauseWeekFailed.length} chưa thể kết luận.`);
    logger.info(`Thư mục đầu ra: ${OUTPUT_DIR}`);
    if (unknownCount > 0) logger.warn("Có sự kiện chưa phân loại. Hãy xem output/utc_unknown_events.json trước khi dùng --include-unknown.");
  } finally {
    await context.close();
  }
}

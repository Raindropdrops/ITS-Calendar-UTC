import type { Page } from "playwright";
import type { CourseWithoutDetail } from "../../models/academic-calendar-event.js";
import { parseVietnameseDate } from "../../utils/date.js";
import { normalizeWhitespace } from "../../utils/text.js";

export async function extractCoursesWithoutDetail(page: Page): Promise<CourseWithoutDetail[]> {
  const stateRows = await page.evaluate((): Record<string, unknown>[] => {
    const value = (window as any).main_doc?.LichGiang?.dtTKBKhongLichChiTiet;
    return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) as Record<string, unknown>[] : [];
  }).catch(() => [] as Record<string, unknown>[]);
  if (stateRows.length > 0) {
    return stateRows.flatMap((row): CourseWithoutDetail[] => {
      const subject = typeof row.TENLOP === "string" ? row.TENLOP.trim() : "";
      if (!subject) return [];
      const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
      return [{
        classCode: text(row.MALOP),
        subject,
        studyMode: text(row.TENHINHTHUCHOC),
        startDate: text(row.NGAYBATDAU) ? parseVietnameseDate(text(row.NGAYBATDAU)!) : undefined,
        endDate: text(row.NGAYKETTHUC) ? parseVietnameseDate(text(row.NGAYKETTHUC)!) : undefined,
        note: text(row.GHICHU),
        rawText: JSON.stringify(row),
      }];
    });
  }
  const rows = page.locator("#tblTKBKhongLichChiTiet tbody tr");
  const values: CourseWithoutDetail[] = [];
  for (let index = 0; index < (await rows.count()); index += 1) {
    const text = normalizeWhitespace(await rows.nth(index).innerText().catch(() => ""));
    if (!text || /mã lớp|tên lớp/i.test(text)) continue;
    const dates = [...text.matchAll(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/g)].map((match) => parseVietnameseDate(match[1]!)!);
    const cells = text.split("\n").filter(Boolean);
    if (cells.length < 2) continue;
    values.push({
      classCode: cells[0],
      subject: cells[1]!,
      startDate: dates[0],
      endDate: dates[1],
      rawText: text,
    });
  }
  return values;
}

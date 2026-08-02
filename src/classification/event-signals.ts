import { stripVietnameseDiacritics } from "../utils/text.js";

export type ClassificationSignal = {
  pattern: RegExp;
  score: number;
  reason: string;
};

export const examSignals: ClassificationSignal[] = [
  { pattern: /\bisExam\b\s*[:=]\s*(true|1)/i, score: 100, reason: "Backend đánh dấu isExam" },
  { pattern: /\b(loaiLich|loaiSuKien|scheduleType|eventType)\b.{0,30}\b(thi|exam)\b/i, score: 100, reason: "Backend ghi rõ loại lịch thi" },
  { pattern: /\b(examType|tenKyThi)\b/i, score: 70, reason: "Có trường dữ liệu riêng của kỳ thi" },
  { pattern: /(^|\s|\[)(thi|lich thi|ky thi)(\s|\]|:|$)/i, score: 45, reason: "Tiêu đề/nội dung ghi thi" },
  { pattern: /\b(ca thi|phong thi|gio thi|ngay thi)\b/i, score: 35, reason: "Có ca/phòng/giờ/ngày thi" },
  { pattern: /\b(hinh thuc thi|thoi luong|thoi gian lam bai|so bao danh)\b/i, score: 40, reason: "Có chi tiết chỉ thường xuất hiện ở lịch thi" },
  { pattern: /\b(tu luan|trac nghiem|van dap|thi ket thuc hoc phan|thi giua ky)\b/i, score: 30, reason: "Có hình thức/loại kỳ thi" },
];

export const otherSignals: ClassificationSignal[] = [
  { pattern: /\b(bao ve|seminar|hoi thao|sinh hoat|co van hoc tap)\b/i, score: 50, reason: "Có tín hiệu sự kiện học vụ" },
];

export function comparableSignalText(value: string): string {
  return stripVietnameseDiacritics(value).toLocaleLowerCase("vi-VN");
}

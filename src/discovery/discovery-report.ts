import type { CandidateEndpoint } from "./candidate-analyzer.js";

export function createDiscoveryReport(candidates: CandidateEndpoint[], currentUrl: string): string {
  const lines = [
    "# Báo cáo discovery QLĐT UTC",
    "",
    `- Thời điểm: ${new Date().toISOString()}`,
    `- URL hiện tại: ${currentUrl}`,
    `- Số endpoint ứng viên: ${candidates.length}`,
    "",
    "## Endpoint được xếp hạng",
    "",
  ];
  if (candidates.length === 0) {
    lines.push("Không ghi nhận được endpoint phù hợp. Hãy bảo đảm tuần đang hiển thị có lịch và thử chuyển tuần trước khi xác nhận.");
  }
  candidates.forEach((candidate, index) => {
    lines.push(
      `### ${index + 1}. Điểm ${candidate.score} — ${candidate.method}`,
      "",
      `- URL: \`${candidate.url}\``,
      `- Content-Type: \`${candidate.contentType ?? "không rõ"}\``,
      `- Số lần xuất hiện: ${candidate.occurrences}`,
      `- Kích thước gần nhất: ${candidate.responseSize ?? "không rõ"} byte`,
      `- Tín hiệu: ${candidate.reasons.join(", ") || "không có"}`,
      "",
    );
  });
  lines.push(
    "## Bảo mật",
    "",
    "Artifacts không chứa request/response headers. Các trường cookie, authorization, CSRF, password và token trong body đã được che.",
    "Không commit thư mục `artifacts/discovery/` vì HTML/screenshot vẫn có thể chứa dữ liệu cá nhân.",
    "",
  );
  return lines.join("\n");
}

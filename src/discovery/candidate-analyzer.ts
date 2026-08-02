import type { NetworkRecord } from "./network-recorder.js";

export type CandidateEndpoint = {
  url: string;
  method: string;
  contentType?: string;
  score: number;
  reasons: string[];
  occurrences: number;
  responseSize?: number;
};

const SIGNALS: Array<[RegExp, number, string]> = [
  [/json/i, 25, "Response JSON"],
  [/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/, 20, "Có ngày tháng"],
  [/\b\d{1,2}[:h]\d{2}\b/i, 15, "Có giờ"],
  [/(tenmon|tenMon|monhoc|môn học|subject|course)/i, 15, "Có trường/tên môn"],
  [/(phong|phòng|room|location)/i, 10, "Có phòng học"],
  [/(malop|maLop|mã lớp|classCode|nhom|nhóm)/i, 10, "Có mã lớp/nhóm"],
  [/(lich|schedule|calendar|timetable|thoi.?khoa.?bieu)/i, 10, "URL/nội dung liên quan lịch"],
  [/(thi|exam|caThi|kyThi)/i, 10, "Có dữ liệu thi"],
];

export function analyzeCandidates(records: NetworkRecord[]): CandidateEndpoint[] {
  const grouped = new Map<string, NetworkRecord[]>();
  for (const record of records) {
    const key = `${record.method} ${record.url}`;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  return [...grouped.values()]
    .map((group): CandidateEndpoint => {
      const representative = group.at(-1)!;
      const searchable = `${representative.url}\n${representative.contentType ?? ""}\n${representative.responseBody ?? ""}`;
      const matches = SIGNALS.filter(([pattern]) => pattern.test(searchable));
      return {
        url: representative.url,
        method: representative.method,
        contentType: representative.contentType,
        score: matches.reduce((sum, [, score]) => sum + score, 0),
        reasons: matches.map(([, , reason]) => reason),
        occurrences: group.length,
        responseSize: representative.responseSize,
      };
    })
    .sort((a, b) => b.score - a.score);
}

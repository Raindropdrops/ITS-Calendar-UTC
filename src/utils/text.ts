export function normalizeWhitespace(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function normalizeIdentityText(value?: string): string {
  if (!value) return "";
  return normalizeWhitespace(value)
    .toLocaleLowerCase("vi-VN")
    .replace(/^\[(thi|học vụ|chưa phân loại)\]\s*/iu, "")
    .replace(/^phòng\s+/iu, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanOptional(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const clean = normalizeWhitespace(value);
  return clean || undefined;
}

export function stripVietnameseDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

export function similarity(left: string, right: string): number {
  const a = normalizeIdentityText(stripVietnameseDiacritics(left));
  const b = normalizeIdentityText(stripVietnameseDiacritics(right));
  if (a === b) return 1;
  if (!a || !b) return 0;
  const aTokens = new Set(a.split(/\s+/));
  const bTokens = new Set(b.split(/\s+/));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

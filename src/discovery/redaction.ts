const SENSITIVE_KEY = /(cookie|authorization|set-cookie|csrf|xsrf|access.?token|refresh.?token|password|passwd|matkhau)/i;
const TOKENISH_VALUE = /(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.?[A-Za-z0-9_.-]*/gi;
const TOKENISH_VALUE_SINGLE = /^(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.?[A-Za-z0-9_.-]*$/i;

export function redactText(value: string): string {
  let output = value;
  try {
    const parsed = JSON.parse(value) as unknown;
    output = JSON.stringify(redactValue(parsed));
  } catch {
    output = value
      .replace(/((?:password|passwd|matkhau|access_token|refresh_token|authorization|cookie)\s*[=:]\s*)[^&\s]+/gi, "$1[REDACTED]")
      .replace(TOKENISH_VALUE, (match) => (match.length > 40 ? "[REDACTED_TOKEN]" : match));
  }
  return output;
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(nested)]),
    );
  }
  if (typeof value === "string" && value.length > 40 && TOKENISH_VALUE_SINGLE.test(value)) return "[REDACTED_TOKEN]";
  return value;
}

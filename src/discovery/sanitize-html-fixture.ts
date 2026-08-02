import { load } from "cheerio";

export function sanitizeHtmlFixture(html: string): string {
  const $ = load(html, null, false);
  $("script, iframe, object, embed").remove();
  $("input, textarea, select").each((_, element) => {
    $(element).removeAttr("value").removeAttr("data-token").empty();
  });
  $("*").each((_, element) => {
    const node = $(element);
    if (!("attribs" in element)) return;
    for (const attribute of Object.keys(element.attribs)) {
      if (/(token|cookie|auth|csrf|xsrf|password|secret|session)/i.test(attribute)) node.removeAttr(attribute);
    }
  });
  let output = $.html();
  output = output
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?84|0)\d{9,10}\b/g, "[REDACTED_PHONE]")
    .replace(/((?:mã sinh viên|masv|student.?id)\s*[:=]?\s*)[A-Za-z0-9_-]+/gi, "$1[REDACTED_STUDENT_ID]")
    .replace(/((?:access.?token|refresh.?token|password|cookie|authorization)\s*[:=]\s*)[^\s<]+/gi, "$1[REDACTED]");
  return output;
}

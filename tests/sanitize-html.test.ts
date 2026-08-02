import { describe, expect, it } from "vitest";
import { sanitizeHtmlFixture } from "../src/discovery/sanitize-html-fixture.js";

describe("sanitized discovery fixture", () => {
  it("removes scripts, credentials and personal identifiers", () => {
    const sanitized = sanitizeHtmlFixture('<div data-token="secret">Mã sinh viên: 12345678 user@example.com 0912345678<input value="password"><script>alert(1)</script></div>');
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("data-token");
    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("0912345678");
    expect(sanitized).not.toContain('value="password"');
  });
});

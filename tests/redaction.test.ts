import { describe, expect, it } from "vitest";
import { redactText } from "../src/discovery/redaction.js";

describe("discovery redaction", () => {
  it("redacts sensitive JSON fields", () => {
    const output = JSON.parse(redactText(JSON.stringify({ subject: "PLC", password: "secret", accessToken: "abcdef" }))) as Record<string, string>;
    expect(output.subject).toBe("PLC");
    expect(output.password).toBe("[REDACTED]");
    expect(output.accessToken).toBe("[REDACTED]");
  });

  it("redacts token-like values consistently", () => {
    const token = "a".repeat(60);
    const output = JSON.parse(redactText(JSON.stringify({ a: token, b: token }))) as Record<string, string>;
    expect(output.a).toBe("[REDACTED_TOKEN]");
    expect(output.b).toBe("[REDACTED_TOKEN]");
  });
});

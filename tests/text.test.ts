import { describe, expect, it } from "vitest";
import { normalizeIdentityText, normalizeWhitespace } from "../src/utils/text.js";

describe("Vietnamese text normalization", () => {
  it("keeps Vietnamese diacritics and cleans unusual spacing", () => {
    expect(normalizeWhitespace("  Điều\u00a0khiển  \n  Logic – PLC  ")).toBe("Điều khiển\nLogic – PLC");
  });

  it("normalizes identity without stripping Vietnamese", () => {
    expect(normalizeIdentityText("[THI]  Điều khiển Logic ")).toBe("điều khiển logic");
  });
});

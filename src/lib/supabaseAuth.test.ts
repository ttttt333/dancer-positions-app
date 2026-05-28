import { describe, expect, it } from "vitest";
import { normalizePhoneE164 } from "./supabaseAuth";

describe("normalizePhoneE164", () => {
  it("keeps E.164 numbers", () => {
    expect(normalizePhoneE164("+819012345678")).toBe("+819012345678");
  });

  it("converts domestic Japan numbers starting with 0", () => {
    expect(normalizePhoneE164("09012345678")).toBe("+819012345678");
  });

  it("prefixes bare numbers with default country code", () => {
    expect(normalizePhoneE164("9012345678")).toBe("+819012345678");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhoneE164("090-1234-5678")).toBe("+819012345678");
  });
});

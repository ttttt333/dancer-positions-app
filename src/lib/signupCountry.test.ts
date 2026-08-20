import { describe, expect, it } from "vitest";
import {
  countryFromLocale,
  countryFromTimezone,
  formatSignupCountry,
  geoFromHints,
  isPublicIp,
  normalizeCountryCode,
} from "./signupCountry";

describe("signup country inference", () => {
  it("maps common timezones and locales", () => {
    expect(countryFromTimezone("Asia/Tokyo")).toBe("JP");
    expect(countryFromTimezone("America/New_York")).toBe("US");
    expect(countryFromLocale("ja-JP")).toBe("JP");
    expect(countryFromLocale("en-GB")).toBe("GB");
    expect(normalizeCountryCode("xx")).toBe("");
  });

  it("rejects private IPs", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("10.0.0.8")).toBe(false);
    expect(isPublicIp("192.168.1.5")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
  });

  it("formats an inferred country for the notify email", () => {
    const geo = geoFromHints({
      countryCode: "KR",
      timezone: "Asia/Seoul",
      locale: "ko-KR",
      source: "ip",
    });
    expect(geo?.countryCode).toBe("KR");
    expect(formatSignupCountry(geo)).toContain("KR");
    expect(formatSignupCountry(geo)).toContain("接続元IP");
    expect(formatSignupCountry(null)).toBe("（未検出）");
  });
});

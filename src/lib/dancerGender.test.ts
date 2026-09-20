import { describe, expect, it } from "vitest";
import {
  DANCER_GENDER_FEMALE_HEX,
  DANCER_GENDER_MALE_HEX,
  parseDancerGenderKind,
  resolveDancerDisplayHex,
} from "./dancerGender";

describe("parseDancerGenderKind", () => {
  it("recognizes male labels", () => {
    expect(parseDancerGenderKind("男子")).toBe("male");
    expect(parseDancerGenderKind("男")).toBe("male");
    expect(parseDancerGenderKind("男性")).toBe("male");
    expect(parseDancerGenderKind("male")).toBe("male");
    expect(parseDancerGenderKind("M")).toBe("male");
  });

  it("recognizes female labels", () => {
    expect(parseDancerGenderKind("女子")).toBe("female");
    expect(parseDancerGenderKind("女")).toBe("female");
    expect(parseDancerGenderKind("女性")).toBe("female");
    expect(parseDancerGenderKind("female")).toBe("female");
    expect(parseDancerGenderKind("F")).toBe("female");
  });

  it("returns null for unknown", () => {
    expect(parseDancerGenderKind("")).toBeNull();
    expect(parseDancerGenderKind(undefined)).toBeNull();
    expect(parseDancerGenderKind("その他")).toBeNull();
  });
});

describe("resolveDancerDisplayHex", () => {
  it("uses gender colors when set", () => {
    expect(resolveDancerDisplayHex("男子", "#111111")).toBe(
      DANCER_GENDER_MALE_HEX
    );
    expect(resolveDancerDisplayHex("女子", "#111111")).toBe(
      DANCER_GENDER_FEMALE_HEX
    );
  });

  it("falls back when gender unset", () => {
    expect(resolveDancerDisplayHex(undefined, "#38bdf8")).toBe("#38bdf8");
  });
});

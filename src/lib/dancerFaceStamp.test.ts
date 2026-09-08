import { describe, expect, it } from "vitest";
import { normalizeDancerFaceStamp } from "./dancerFaceStamp";

describe("normalizeDancerFaceStamp", () => {
  it("accepts known ids", () => {
    expect(normalizeDancerFaceStamp("smile")).toBe("smile");
    expect(normalizeDancerFaceStamp("sparkle")).toBe("sparkle");
  });

  it("rejects unknown values", () => {
    expect(normalizeDancerFaceStamp("nope")).toBeUndefined();
    expect(normalizeDancerFaceStamp(1)).toBeUndefined();
    expect(normalizeDancerFaceStamp(null)).toBeUndefined();
  });
});

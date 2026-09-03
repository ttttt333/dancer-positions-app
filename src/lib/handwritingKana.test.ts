import { describe, expect, it } from "vitest";
import { handwritingNameCost } from "./handwritingKana";

describe("handwritingNameCost", () => {
  it("maps a cramped あ/か slip onto ほのか", () => {
    expect(handwritingNameCost("ほのあ", "ほのか")).toBe(1);
  });

  it("does not treat はなか and ほなか as the same hand", () => {
    expect(handwritingNameCost("はなか", "ほなか")).toBeNull();
  });

  it("does not treat かえご and かえで as a handwriting quirk", () => {
    expect(handwritingNameCost("かえご", "かえで")).toBeNull();
  });

  it("maps うあ onto うめ via あ/め", () => {
    expect(handwritingNameCost("うあ", "うめ")).toBe(1);
  });
});

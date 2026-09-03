import { describe, expect, it } from "vitest";
import { handwritingNameCost, smallSetNameCost } from "./handwritingKana";

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

describe("smallSetNameCost", () => {
  it("maps unique 1-edit leftovers in a small remaining set", () => {
    expect(smallSetNameCost("まりあ", "まあ")).toBe(3);
    expect(smallSetNameCost("れむ", "れお")).toBe(3);
    expect(smallSetNameCost("ゆうゆ", "ゆうか")).toBe(3);
    expect(smallSetNameCost("しょう", "しゅう")).toBe(3);
  });

  it("maps unique 2-edit leftovers of 3+ mora", () => {
    expect(smallSetNameCost("ほめい", "ほのか")).toBe(4);
  });

  it("still does not treat はなか and ほなか as the same person", () => {
    expect(smallSetNameCost("はなか", "ほなか")).toBeNull();
  });
});

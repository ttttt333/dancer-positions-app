/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { intentMatchScore, prohibitedTypes, rankedTypesForIntent } from "./FormationIntentMapper";
import { makeIntent } from "./formationFixtures";

describe("FormationIntentMapper", () => {
  it("maps EXPAND to wide geometries", () => {
    const ranked = rankedTypesForIntent(makeIntent("EXPAND", ["V", "DIAGONAL"], ["CLUSTER"]));
    expect(ranked[0]).toBe("WIDE_V");
    expect(prohibitedTypes(makeIntent("EXPAND", [], ["CLUSTER"]))).toContain("CLUSTER");
  });

  it("scores EXPAND + WIDE_V at 100 and CLUSTER at 0", () => {
    const intent = makeIntent("EXPAND", ["V"], ["CLUSTER"]);
    expect(intentMatchScore("WIDE_V", intent)).toBe(100);
    expect(intentMatchScore("LINE", intent)).toBe(70);
    expect(intentMatchScore("CLUSTER", intent)).toBe(0);
  });

  it("CONTRACT prefers CLUSTER", () => {
    expect(intentMatchScore("CLUSTER", makeIntent("CONTRACT"))).toBe(100);
  });
});

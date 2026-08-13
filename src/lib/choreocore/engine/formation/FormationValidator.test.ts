/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { validateFormation } from "./FormationValidator";
import { DEFAULT_STAGE } from "./formationFixtures";
import type { Formation } from "../types/FormationTypes";

function formation(positions: Formation["positions"]): Formation {
  return {
    id: "f",
    type: "LINE",
    positions,
    symmetry: 50,
    complexity: 20,
    stageCoverage: 40,
    visualImpact: 40,
    tags: [],
  };
}

describe("FormationValidator", () => {
  it("flags points outside the safe margin", () => {
    const reasons = validateFormation(
      formation({ d0: { x: 10, y: 10 }, d1: { x: 500, y: 300 } }),
      2,
      DEFAULT_STAGE
    );
    expect(reasons).toContain("OUTSIDE_SAFE_MARGIN");
  });

  it("flags duplicate points and spacing", () => {
    const dup = validateFormation(
      formation({ d0: { x: 400, y: 300 }, d1: { x: 400, y: 300 } }),
      2,
      DEFAULT_STAGE
    );
    expect(dup).toContain("DUPLICATE_POINT");
    const close = validateFormation(
      formation({ d0: { x: 400, y: 300 }, d1: { x: 410, y: 300 } }),
      2,
      DEFAULT_STAGE
    );
    expect(close).toContain("MIN_SPACING");
  });

  it("accepts a valid pair", () => {
    const reasons = validateFormation(
      formation({ d0: { x: 300, y: 300 }, d1: { x: 500, y: 300 } }),
      2,
      DEFAULT_STAGE
    );
    expect(reasons).toEqual([]);
  });
});

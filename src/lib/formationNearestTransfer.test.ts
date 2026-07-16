import { describe, expect, it } from "vitest";
import { minCostBipartiteAssignment } from "./minCostAssignment";
import { transferDancerIdentitiesByNearestPosition } from "./formationLayouts";
import type { DancerSpot } from "../types/choreography";

function spot(
  id: string,
  label: string,
  xPct: number,
  yPct: number
): DancerSpot {
  return { id, label, xPct, yPct, colorIndex: 0 };
}

describe("minCostBipartiteAssignment", () => {
  it("solves a classic greedy-trap: A near both slots, B only near slot1", () => {
    // A→slot1 cost 1, A→slot2 cost 1.2; B→slot1 cost 1.1, B→slot2 cost 10
    // Greedy would give A slot1 and B slot2 (bad). Optimal: B→1, A→2.
    const assignment = minCostBipartiteAssignment([
      [1, 1.2],
      [1.1, 10],
    ]);
    expect(assignment).toEqual([1, 0]);
  });

  it("handles more columns than rows", () => {
    const assignment = minCostBipartiteAssignment([
      [5, 1, 9],
      [8, 7, 2],
    ]);
    expect(assignment).toEqual([1, 2]);
  });
});

describe("transferDancerIdentitiesByNearestPosition", () => {
  it("keeps a front-center dancer near center instead of a far wing (greedy trap)", () => {
    const prev = [
      spot("nagi", "なぎ", 30, 25),
      spot("sosuke", "そうすけ", 70, 25),
      spot("taichi", "たいち", 18, 35),
      spot("ouji", "おうじ", 38, 38),
      spot("hinata", "ひなた", 62, 38),
      spot("aiki", "あいき", 82, 35),
      spot("kii", "きい", 28, 48),
      spot("sara", "さら", 42, 50),
      spot("hina", "ひな", 58, 50),
      spot("kaho", "かほ", 72, 48),
      spot("koko", "ここ", 35, 60),
      spot("nanase", "ななせ", 50, 58),
      spot("kanna", "かんな", 65, 60),
      spot("ayane", "あやね", 42, 72),
      spot("aina", "あいな", 58, 72),
    ];
    const preset = [
      spot("s0", "0", 18, 22),
      spot("s1", "1", 35, 28),
      spot("s2", "2", 50, 22),
      spot("s3", "3", 65, 28),
      spot("s4", "4", 82, 22),
      spot("s5", "5", 30, 38),
      spot("s6", "6", 42, 42),
      spot("s7", "7", 58, 42),
      spot("s8", "8", 70, 38),
      spot("s9", "9", 35, 52),
      spot("s10", "10", 50, 50),
      spot("s11", "11", 65, 52),
      spot("s12", "12", 42, 62),
      spot("s13", "13", 58, 62),
      spot("s14", "14", 50, 75),
    ];

    const result = transferDancerIdentitiesByNearestPosition(preset, prev);
    const aina = result.find((d) => d.id === "aina");
    expect(aina).toBeTruthy();
    // Front-center-ish: not a back wing (x≈18/82)
    expect(aina!.xPct).toBeGreaterThan(35);
    expect(aina!.xPct).toBeLessThan(65);
    expect(aina!.yPct).toBeGreaterThan(55);
  });

  it("preserves identitySource order", () => {
    const prev = [
      spot("a", "A", 20, 50),
      spot("b", "B", 80, 50),
    ];
    const preset = [
      spot("p0", "0", 75, 50),
      spot("p1", "1", 25, 50),
    ];
    const result = transferDancerIdentitiesByNearestPosition(preset, prev);
    expect(result.map((d) => d.id)).toEqual(["a", "b"]);
    expect(result[0]!.xPct).toBe(25);
    expect(result[1]!.xPct).toBe(75);
  });
});

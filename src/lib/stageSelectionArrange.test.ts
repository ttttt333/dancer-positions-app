import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  applyPositionSort,
  formatPositionSortPreview,
  permuteSlotsByHeightAsc,
  swapTwoDancerPositions,
} from "./stageSelectionArrange";

function spot(
  id: string,
  xPct: number,
  yPct: number,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return { id, label: id, xPct, yPct, colorIndex: 0, ...extra };
}

describe("swapTwoDancerPositions", () => {
  it("exchanges x/y for exactly two dancers and keeps identity", () => {
    const dancers = [
      spot("a", 20, 30, { label: "A", facingDeg: 90 }),
      spot("b", 80, 70, { label: "B", facingDeg: 180 }),
      spot("c", 50, 50, { label: "C" }),
    ];
    const next = swapTwoDancerPositions(dancers, ["a", "b"]);
    expect(next.find((d) => d.id === "a")).toMatchObject({
      xPct: 80,
      yPct: 70,
      label: "A",
      facingDeg: 90,
    });
    expect(next.find((d) => d.id === "b")).toMatchObject({
      xPct: 20,
      yPct: 30,
      label: "B",
      facingDeg: 180,
    });
    expect(next.find((d) => d.id === "c")).toEqual(dancers[2]);
  });

  it("no-ops unless exactly two ids", () => {
    const dancers = [spot("a", 10, 10), spot("b", 90, 90)];
    expect(swapTwoDancerPositions(dancers, ["a"])).toEqual(dancers);
    expect(swapTwoDancerPositions(dancers, ["a", "b", "a"])).toEqual(dancers);
  });
});

describe("applyPositionSort", () => {
  it("all + height + asc matches the old slot permute", () => {
    const dancers = [
      spot("tall", 20, 40, { heightCm: 180 }),
      spot("short", 80, 40, { heightCm: 150 }),
      spot("mid", 50, 40, { heightCm: 165 }),
    ];
    const ids = dancers.map((d) => d.id);
    const next = applyPositionSort(dancers, ids, {
      axis: "height",
      scope: "all",
      direction: "asc",
    });
    const legacy = permuteSlotsByHeightAsc(dancers, ids);
    expect(next.map((d) => [d.id, d.xPct])).toEqual(legacy.map((d) => [d.id, d.xPct]));
  });

  it("row sorts each depth row independently without mixing rows", () => {
    const dancers = [
      spot("backTall", 20, 20, { heightCm: 180 }),
      spot("backShort", 80, 20, { heightCm: 150 }),
      spot("frontTall", 20, 80, { heightCm: 178 }),
      spot("frontShort", 80, 80, { heightCm: 148 }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "height", scope: "row", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.backShort!.xPct).toBeLessThan(byId.backTall!.xPct);
    expect(byId.frontShort!.xPct).toBeLessThan(byId.frontTall!.xPct);
    expect(byId.backShort!.yPct).toBeLessThan(50);
    expect(byId.frontShort!.yPct).toBeGreaterThan(50);
  });

  it("col sorts each vertical column independently", () => {
    const dancers = [
      spot("leftHigh", 25, 20, { gradeLabel: "中3" }),
      spot("leftLow", 25, 80, { gradeLabel: "小1" }),
      spot("rightHigh", 75, 20, { gradeLabel: "高2" }),
      spot("rightLow", 75, 80, { gradeLabel: "小2" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "grade", scope: "col", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.leftLow!.yPct).toBeLessThan(byId.leftHigh!.yPct);
    expect(byId.rightLow!.yPct).toBeLessThan(byId.rightHigh!.yPct);
    expect(byId.leftLow!.xPct).toBeLessThan(50);
    expect(byId.rightLow!.xPct).toBeGreaterThan(50);
  });

  it("col sorts skill ascending toward the audience (front / high y)", () => {
    const dancers = [
      spot("backSkilled", 40, 20, { skillRankLabel: "1" }),
      spot("frontUnskilled", 40, 80, { skillRankLabel: "5" }),
      spot("backMid", 70, 25, { skillRankLabel: "2" }),
      spot("frontMid", 70, 75, { skillRankLabel: "4" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "skill", scope: "col", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.backSkilled!.yPct).toBeGreaterThan(byId.frontUnskilled!.yPct);
    expect(byId.backMid!.yPct).toBeGreaterThan(byId.frontMid!.yPct);
  });

  it("all + skill + asc puts #1 on front near-center shimote when center is split", () => {
    const dancers = [
      spot("a", 30, 30, { skillRankLabel: "5" }),
      spot("b", 70, 30, { skillRankLabel: "1" }),
      spot("c", 30, 70, { skillRankLabel: "3" }),
      spot("d", 70, 70, { skillRankLabel: "2" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "skill", scope: "all", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    /** skill 1 → 一列目・センター割れの下手側 (30,70) */
    expect(byId.b).toMatchObject({ xPct: 30, yPct: 70 });
    expect(byId.d).toMatchObject({ xPct: 70, yPct: 70 });
    expect(byId.c).toMatchObject({ xPct: 30, yPct: 30 });
    expect(byId.a).toMatchObject({ xPct: 70, yPct: 30 });
  });

  it("all + skill + asc puts #1 on exact front center when present", () => {
    const dancers = [
      spot("s1", 20, 80, { skillRankLabel: "3" }),
      spot("s2", 50, 80, { skillRankLabel: "1" }),
      spot("s3", 80, 80, { skillRankLabel: "2" }),
      spot("back", 50, 20, { skillRankLabel: "4" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "skill", scope: "all", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.s2).toMatchObject({ xPct: 50, yPct: 80 });
    /** 2・3 はセンター次点（下手→上手） */
    expect(byId.s3).toMatchObject({ xPct: 20, yPct: 80 });
    expect(byId.s1).toMatchObject({ xPct: 80, yPct: 80 });
    expect(byId.back!.yPct).toBe(20);
  });

  it("row + skill + asc places smaller numbers nearer center (shimote on split)", () => {
    const dancers = [
      spot("a", 20, 50, { skillRankLabel: "4" }),
      spot("b", 40, 50, { skillRankLabel: "1" }),
      spot("c", 60, 50, { skillRankLabel: "2" }),
      spot("d", 80, 50, { skillRankLabel: "3" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "skill", scope: "row", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.b!.xPct).toBe(40);
    expect(byId.c!.xPct).toBe(60);
    expect(byId.d!.xPct).toBe(20);
    expect(byId.a!.xPct).toBe(80);
  });

  it("builds the preview sentence from axis, direction, and scope", () => {
    expect(
      formatPositionSortPreview({
        axis: "grade",
        scope: "col",
        direction: "asc",
      })
    ).toBe("学年が低学年から、縦一列で並べ替えます");
  });
});

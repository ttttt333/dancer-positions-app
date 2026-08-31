import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  applyLayoutPresetToTargetDancers,
  layoutPresetPositionsById,
  resolveChangeTargetIds,
  translateSpotsToMatchCentroid,
} from "./applyLayoutPresetToSelection";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByOrder,
} from "./formationLayouts";

function spot(
  id: string,
  xPct: number,
  yPct: number,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return {
    id,
    label: id,
    xPct,
    yPct,
    colorIndex: 0,
    crewMemberId: `crew-${id}`,
    ...extra,
  };
}

function identityOf(d: DancerSpot) {
  const { xPct: _x, yPct: _y, ...rest } = d;
  return rest;
}

describe("resolveChangeTargetIds", () => {
  const formation = ["a", "b", "c", "d"];

  it("uses everyone when nothing is selected", () => {
    expect(resolveChangeTargetIds(formation, [])).toEqual(formation);
  });

  it("uses everyone when only one person is selected", () => {
    expect(resolveChangeTargetIds(formation, ["b"])).toEqual(formation);
  });

  it("uses the selected subset when 2+ formation members are selected", () => {
    expect(resolveChangeTargetIds(formation, ["d", "a"])).toEqual(["d", "a"]);
  });

  it("drops stale ids and falls back to everyone if fewer than 2 remain", () => {
    expect(resolveChangeTargetIds(formation, ["gone", "a"])).toEqual(formation);
  });

  it("keeps a live subset after dropping stale ids", () => {
    expect(resolveChangeTargetIds(formation, ["gone", "a", "c"])).toEqual([
      "a",
      "c",
    ]);
  });
});

describe("applyLayoutPresetToTargetDancers", () => {
  it("matches existing Change identity transfer when everyone is the target", () => {
    const dancers = [
      spot("a", 10, 40, { facingDeg: 15 }),
      spot("b", 20, 40),
      spot("c", 30, 40),
    ];
    const next = applyLayoutPresetToTargetDancers(
      dancers,
      dancers.map((d) => d.id),
      "line"
    );
    const expected = transferDancerIdentitiesByOrder(
      dancersForLayoutPreset(3, "line"),
      dancers
    );
    expect(next.map((d) => d.id)).toEqual(expected.map((d) => d.id));
    expect(next.map((d) => d.xPct)).toEqual(expected.map((d) => d.xPct));
    expect(next.map((d) => d.yPct)).toEqual(expected.map((d) => d.yPct));
  });

  it("moves only the selected people and keeps everyone else's position and id", () => {
    const back = [
      spot("b1", 30, 30),
      spot("b2", 50, 30),
      spot("b3", 70, 30),
    ];
    const front = [
      spot("f1", 20, 70, { facingDeg: 90, note: "keep-me" }),
      spot("f2", 40, 72),
      spot("f3", 60, 71),
      spot("f4", 80, 70),
    ];
    const dancers = [...back, ...front];
    const selected = front.map((d) => d.id);

    const next = applyLayoutPresetToTargetDancers(
      dancers,
      selected,
      "line"
    );

    expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
    for (const id of ["b1", "b2", "b3"]) {
      const before = dancers.find((d) => d.id === id)!;
      const after = next.find((d) => d.id === id)!;
      expect(after.xPct).toBe(before.xPct);
      expect(after.yPct).toBe(before.yPct);
      expect(identityOf(after)).toEqual(identityOf(before));
    }

    const moved = next.filter((d) => selected.includes(d.id));
    expect(new Set(moved.map((d) => d.yPct)).size).toBe(1);
    expect(moved.map((d) => d.xPct).sort((a, b) => a - b)).not.toEqual(
      front.map((d) => d.xPct)
    );
    expect(next.find((d) => d.id === "f1")?.facingDeg).toBe(90);
    expect(next.find((d) => d.id === "f1")?.note).toBe("keep-me");
    expect(next.find((d) => d.id === "f1")?.crewMemberId).toBe("crew-f1");
  });

  it("places a 7-person pyramid on the selected front row, not the whole cue", () => {
    const backRow = Array.from({ length: 13 }, (_, i) =>
      spot(`back-${i}`, 12 + i * 6, 32)
    );
    const frontRow = Array.from({ length: 7 }, (_, i) =>
      spot(`front-${i}`, 14 + i * 12, 72)
    );
    const dancers = [...backRow, ...frontRow];
    const selected = frontRow.map((d) => d.id);

    const next = applyLayoutPresetToTargetDancers(
      dancers,
      selected,
      "pyramid"
    );

    for (const d of backRow) {
      const after = next.find((x) => x.id === d.id)!;
      expect(after.xPct).toBe(d.xPct);
      expect(after.yPct).toBe(d.yPct);
    }

    const moved = next.filter((d) => selected.includes(d.id));
    const ys = [...new Set(moved.map((d) => Math.round(d.yPct)))];
    expect(ys.length).toBeGreaterThan(1);
    const cy =
      moved.reduce((s, d) => s + d.yPct, 0) / moved.length;
    expect(cy).toBeGreaterThan(55);
  });

  it("layoutPresetPositionsById keeps dancer ids and returns new coordinates", () => {
    const dancers = [
      spot("a", 10, 40),
      spot("b", 50, 40),
      spot("c", 90, 40),
    ];
    const pos = layoutPresetPositionsById(dancers, ["a", "b", "c"], "pyramid");
    expect(pos.size).toBe(3);
    expect(pos.has("a")).toBe(true);
    expect(pos.has("b")).toBe(true);
    expect(pos.has("c")).toBe(true);
    expect(dancers.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
});

describe("translateSpotsToMatchCentroid", () => {
  it("keeps relative offsets while matching the reference centroid", () => {
    const spots = [spot("a", 40, 40), spot("b", 60, 40)];
    const reference = [spot("a", 20, 80), spot("b", 40, 80)];
    const next = translateSpotsToMatchCentroid(spots, reference);
    const from = centroid(next);
    expect(from.x).toBeCloseTo(30, 5);
    expect(from.y).toBeCloseTo(80, 5);
    expect(next[1]!.xPct - next[0]!.xPct).toBeCloseTo(20, 5);
  });
});

function centroid(spots: readonly { xPct: number; yPct: number }[]) {
  const n = spots.length;
  return {
    x: spots.reduce((s, d) => s + d.xPct, 0) / n,
    y: spots.reduce((s, d) => s + d.yPct, 0) / n,
  };
}

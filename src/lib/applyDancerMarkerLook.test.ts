import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { cloneFormationForNewCue } from "./cueInterval";
import { applyDancerMarkerLook } from "./applyDancerMarkerLook";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";

function seed(): ChoreographyProjectJson {
  const base = createEmptyProject();
  const f0 = base.formations[0]!;
  const dancers: DancerSpot[] = [
    { id: "a", label: "A", xPct: 30, yPct: 50, colorIndex: 0 },
    { id: "b", label: "B", xPct: 70, yPct: 50, colorIndex: 1 },
  ];
  const fA = { ...f0, dancers };
  const fB = cloneFormationForNewCue(fA, { preserveName: true });
  const cueA = { id: "cueA", tStartSec: 0, tEndSec: 5, formationId: fA.id } as Cue;
  const cueB = { id: "cueB", tStartSec: 10, tEndSec: 15, formationId: fB.id } as Cue;
  return { ...base, formations: [fA, fB], cues: [cueA, cueB], activeFormationId: fA.id };
}

const spot = (p: ChoreographyProjectJson, cueId: string, id: string) => {
  const fid = p.cues.find((c) => c.id === cueId)!.formationId;
  return p.formations.find((f) => f.id === fid)!.dancers.find((d) => d.id === id)!;
};

describe("印の形・向きの適用範囲", () => {
  it("このキューだけ: 他のキューの形は変わらない", () => {
    const p0 = seed();
    const p = applyDancerMarkerLook(p0, {
      formationId: p0.cues[0]!.formationId,
      cueId: "cueA",
      dancerIds: ["a"],
      scope: "cue",
      patch: { kind: "shape", shape: "arrow" },
    });
    expect(spot(p, "cueA", "a").markerShape).toBe("arrow");
    expect(spot(p, "cueB", "a").markerShape).toBeUndefined();
    expect(spot(p, "cueA", "b").markerShape).toBeUndefined();
  });

  it("すべてのキュー: 同じ人の形と向きを全キューで揃える", () => {
    const p0 = seed();
    let p = applyDancerMarkerLook(p0, {
      formationId: p0.cues[0]!.formationId,
      cueId: "cueA",
      dancerIds: ["a"],
      scope: "all",
      patch: { kind: "shape", shape: "arrow" },
    });
    p = applyDancerMarkerLook(p, {
      formationId: p.cues[0]!.formationId,
      cueId: "cueA",
      dancerIds: ["a"],
      scope: "all",
      patch: { kind: "facing", deg: 90 },
    });
    expect(spot(p, "cueB", "a").markerShape).toBe("arrow");
    expect(spot(p, "cueB", "a").facingDeg).toBe(90);
    expect(spot(p, "cueB", "b").facingDeg).toBeUndefined();
  });

  it("このキューだけ: 共有している立ち位置は複製してから変える", () => {
    const p0 = seed();
    const fid = p0.cues[0]!.formationId;
    const shared = { ...p0, cues: p0.cues.map((c) => ({ ...c, formationId: fid })) };
    const p = applyDancerMarkerLook(shared, {
      formationId: fid,
      cueId: "cueB",
      dancerIds: ["a"],
      scope: "cue",
      patch: { kind: "facing", deg: 180 },
    });
    expect(spot(p, "cueB", "a").facingDeg).toBe(180);
    expect(spot(p, "cueA", "a").facingDeg).toBeUndefined();
  });
});

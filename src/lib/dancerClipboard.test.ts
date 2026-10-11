import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { cloneFormationForNewCue } from "./cueInterval";
import { pasteDancersIntoCue, previousCueOf } from "./dancerClipboard";
import { clearDancersAtTimeCache, dancersAtTime } from "./interpolatePlayback";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";

function seed(): ChoreographyProjectJson {
  const base = createEmptyProject();
  const f0 = base.formations[0]!;
  const dancers: DancerSpot[] = [
    { id: "a", label: "あい", xPct: 30, yPct: 50, colorIndex: 1 },
  ];
  const fA = { ...f0, dancers };
  const fB = cloneFormationForNewCue(fA, { preserveName: true });
  const newcomer: DancerSpot = {
    id: "n",
    label: "ゆう",
    xPct: 70,
    yPct: 40,
    colorIndex: 5,
    crewMemberId: "crew-n",
    heightCm: 160,
  };
  fB.dancers = [...fB.dancers, newcomer];
  const cueA = { id: "cueA", tStartSec: 0, tEndSec: 5, formationId: fA.id } as Cue;
  const cueB = { id: "cueB", tStartSec: 10, tEndSec: 15, formationId: fB.id } as Cue;
  return {
    ...base,
    formations: [fA, fB],
    cues: [cueB, cueA],
    activeFormationId: fA.id,
  };
}

describe("メンバーのコピー＆貼り付け", () => {
  it("直前のキューを時間順で返す", () => {
    const p = seed();
    expect(previousCueOf(p, "cueB")?.id).toBe("cueA");
    expect(previousCueOf(p, "cueA")).toBe(null);
  });

  it("前のキューに色・名前・データごと貼り付け、指定位置に置ける", () => {
    const p = seed();
    const newcomer = p.formations[1]!.dancers.find((d) => d.id === "n")!;
    const { project, pastedIds } = pasteDancersIntoCue(p, {
      formationId: p.formations[0]!.id,
      cueId: "cueA",
      spots: [newcomer],
      at: { xPct: -20, yPct: 45 },
    });
    expect(pastedIds).toEqual(["n"]);
    const fA = project.formations.find(
      (f) => f.id === project.cues.find((c) => c.id === "cueA")!.formationId
    )!;
    const pasted = fA.dancers.find((d) => d.id === "n")!;
    expect(pasted.label).toBe("ゆう");
    expect(pasted.colorIndex).toBe(5);
    expect(pasted.crewMemberId).toBe("crew-n");
    expect(pasted.heightCm).toBe(160);
    expect(pasted.xPct).toBe(-20);
    expect(pasted.yPct).toBe(45);
    expect(fA.dancers.length).toBe(2);

    clearDancersAtTimeCache();
    const mid = dancersAtTime(7.5, project.cues, project.formations, project.activeFormationId);
    const nMid = mid.find((d) => d.id === "n")!;
    expect(nMid.xPct).toBeGreaterThan(-20);
    expect(nMid.xPct).toBeLessThan(70);
  });

  it("同じ人がすでにいるキューでは増やさず位置だけ動かす", () => {
    const p = seed();
    const a = p.formations[0]!.dancers[0]!;
    const { project } = pasteDancersIntoCue(p, {
      formationId: p.formations[1]!.id,
      cueId: "cueB",
      spots: [a],
      at: { xPct: 10, yPct: 10 },
    });
    const fB = project.formations.find((f) => f.id === p.formations[1]!.id)!;
    expect(fB.dancers.filter((d) => d.id === "a").length).toBe(1);
    expect(fB.dancers.find((d) => d.id === "a")!.xPct).toBe(10);
  });
});

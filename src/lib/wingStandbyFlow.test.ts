import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { cloneFormationForNewCue } from "./cueInterval";
import { moveOtherMembersToWings, removeMembersFromStage } from "./removeMemberFromStage";
import { clearDancersAtTimeCache, dancersAtTime } from "./interpolatePlayback";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";

function seed(): ChoreographyProjectJson {
  const base = createEmptyProject();
  const f0 = base.formations[0]!;
  const dancers: DancerSpot[] = [20, 35, 50, 65, 80, 50].map((x, i) => ({
    id: `d${i}`,
    label: String(i + 1),
    xPct: x,
    yPct: i === 5 ? 30 : 60,
    colorIndex: i,
  }));
  const cueA: Cue = { id: "cueA", tStartSec: 0, tEndSec: 5, formationId: f0.id } as Cue;
  return {
    ...base,
    formations: [{ ...f0, dancers }],
    cues: [cueA],
    activeFormationId: f0.id,
  };
}

function addCueClonedFrom(p: ChoreographyProjectJson, srcCueId: string, id: string, t0: number) {
  const src = p.cues.find((c) => c.id === srcCueId)!;
  const f = p.formations.find((x) => x.id === src.formationId)!;
  const cloned = cloneFormationForNewCue(f, { preserveName: true });
  const cue = { id, tStartSec: t0, tEndSec: t0 + 5, formationId: cloned.id } as Cue;
  return { ...p, formations: [...p.formations, cloned], cues: [...p.cues, cue] };
}

function at(p: ChoreographyProjectJson, t: number) {
  clearDancersAtTimeCache();
  return dancersAtTime(t, p.cues, p.formations, p.activeFormationId);
}

describe("袖待機 → 削除 → 次のキュー", () => {
  it("次のキューで袖の人を消しても、残った人は自分の位置から動く", () => {
    let p = seed();
    p = moveOtherMembersToWings(p, {
      formationId: p.cues[0]!.formationId,
      cueId: "cueA",
      keepDancerIds: ["d2", "d5"],
    });
    p = addCueClonedFrom(p, "cueA", "cueB", 10);
    const fB = p.cues.find((c) => c.id === "cueB")!.formationId;
    p = removeMembersFromStage(p, {
      formationId: fB,
      cueId: "cueB",
      dancerIds: ["d0", "d1"],
      scope: "cue",
    });
    // 残った d2 を移動先で動かす
    p = {
      ...p,
      formations: p.formations.map((f) =>
        f.id === fB
          ? { ...f, dancers: f.dancers.map((d) => (d.id === "d2" ? { ...d, xPct: 30 } : d)) }
          : f
      ),
    };
    const mid = at(p, 7.5);
    const byId = new Map(mid.map((d) => [d.id, d]));
    expect(byId.get("d2")!.xPct).toBeGreaterThan(30);
    expect(byId.get("d2")!.xPct).toBeLessThan(50);
    expect(byId.get("d5")!.xPct).toBeCloseTo(50);
    // 袖に残る人（d3, d4）は袖のまま
    expect(byId.get("d3")!.xPct).toBeGreaterThan(100);
    expect(byId.get("d4")!.xPct).toBeGreaterThan(100);
    // 次のキューで消した人は移動中も袖にいる（舞台を横切らない）
    expect(byId.get("d0")!.xPct).toBeLessThan(0);
    expect(byId.get("d1")!.xPct).toBeLessThan(0);
    // 同じ人が二重に出ない
    expect(new Set(mid.map((d) => d.id)).size).toBe(mid.length);
  });

  it("「選んだメンバーだけ舞台に残す」で袖の人を選ぶと、前のキューの位置に戻る", () => {
    let p = seed();
    p = moveOtherMembersToWings(p, {
      formationId: p.cues[0]!.formationId,
      cueId: "cueA",
      keepDancerIds: ["d2"],
    });
    p = addCueClonedFrom(p, "cueA", "cueB", 10);
    // cueA を袖待機前の位置に戻した状態を作る（前キューに舞台上の記録がある）
    const seeded = seed();
    p = { ...p, cues: [...p.cues, { ...seeded.cues[0]!, id: "cue0", tStartSec: -10, tEndSec: -5 }], formations: [...p.formations, seeded.formations[0]!] };
    const fB = p.cues.find((c) => c.id === "cueB")!.formationId;
    p = moveOtherMembersToWings(p, { formationId: fB, cueId: "cueB", keepDancerIds: ["d2", "d0"] });
    const dancers = p.formations.find((f) => f.id === p.cues.find((c) => c.id === "cueB")!.formationId)!.dancers;
    const d0 = dancers.find((d) => d.id === "d0")!;
    expect(d0.xPct).toBeCloseTo(20);
    expect(d0.yPct).toBeCloseTo(60);
    expect(dancers.find((d) => d.id === "d1")!.xPct).toBeLessThan(0);
  });

  it("袖から舞台に戻す人は袖から歩いて戻る", () => {
    let p = seed();
    p = moveOtherMembersToWings(p, {
      formationId: p.cues[0]!.formationId,
      cueId: "cueA",
      keepDancerIds: ["d2"],
    });
    p = addCueClonedFrom(p, "cueA", "cueB", 10);
    const fB = p.cues.find((c) => c.id === "cueB")!.formationId;
    p = {
      ...p,
      formations: p.formations.map((f) =>
        f.id === fB
          ? { ...f, dancers: f.dancers.map((d) => (d.id === "d0" ? { ...d, xPct: 20, yPct: 60 } : d)) }
          : f
      ),
    };
    const early = at(p, 5.5);
    const d0 = early.find((d) => d.id === "d0")!;
    expect(d0.xPct).toBeLessThan(5);
    const end = at(p, 10.5);
    expect(end.find((d) => d.id === "d0")!.xPct).toBeCloseTo(20);
  });
});

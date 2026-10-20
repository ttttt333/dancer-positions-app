import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  buildRangeExcerptProject,
  formatSecToClock,
  parseClockToSec,
} from "./buildRangeExcerptProject";
import type { ChoreographyProjectJson, Cue, StageLightFixture } from "../types/choreography";

function seed(): ChoreographyProjectJson {
  const base = createEmptyProject();
  const f0 = base.formations[0]!;
  const formations = ["fa", "fb", "fc"].map((id) => ({ ...f0, id, name: id }));
  const cues = [
    { id: "a", tStartSec: 0, tEndSec: 60, formationId: "fa" },
    { id: "b", tStartSec: 100, tEndSec: 150, formationId: "fb" },
    { id: "c", tStartSec: 300, tEndSec: 400, formationId: "fc" },
  ] as Cue[];
  const stageLights = [
    { id: "La", cueId: "a" },
    { id: "Lc", cueId: "c" },
    { id: "Gall", cueId: null },
    { id: "Glate", cueId: null, tStartSec: 350, tEndSec: 380 },
  ] as unknown as StageLightFixture[];
  return { ...base, formations, cues, stageLights, activeFormationId: "fc" };
}

describe("範囲だけの生徒用コピー", () => {
  it("時間の入力を読める", () => {
    expect(parseClockToSec("2:00")).toBe(120);
    expect(parseClockToSec("125")).toBe(125);
    expect(parseClockToSec("1:02:03")).toBe(3723);
    expect(parseClockToSec("abc")).toBe(null);
    expect(formatSecToClock(125)).toBe("2:05");
  });

  it("前半2分だけ: 範囲外のキュー・立ち位置・照明は入らない", () => {
    const p = buildRangeExcerptProject(seed(), 0, 120);
    expect(p.cues.map((c) => c.id)).toEqual(["a", "b"]);
    expect(p.cues.find((c) => c.id === "b")!.tEndSec).toBe(120);
    expect(p.formations.map((f) => f.id).sort()).toEqual(["fa", "fb"]);
    expect(p.activeFormationId).toBe("fa");
    expect((p.stageLights ?? []).map((L) => L.id)).toEqual(["La", "Gall"]);
    expect(p.trimStartSec).toBe(0);
    expect(p.trimEndSec).toBe(120);
  });

  it("後半だけ: 再生範囲が範囲に合う", () => {
    const p = buildRangeExcerptProject(seed(), 280, 400);
    expect(p.cues.map((c) => c.id)).toEqual(["c"]);
    expect(p.formations.map((f) => f.id)).toEqual(["fc"]);
    expect((p.stageLights ?? []).map((L) => L.id)).toEqual(["Lc", "Gall", "Glate"]);
    expect(p.trimStartSec).toBe(280);
    expect(p.trimEndSec).toBe(400);
  });
});

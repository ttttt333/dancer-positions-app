import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  buildPrevCueCompareMarks,
  defaultTravelMatchCueId,
  listTravelMatchCueOptions,
  listTravelMatchCueOptionsForInsert,
  resolveCueDancersById,
  resolvePreviousCueDancers,
  resolvePreviousCueOrdinal,
  resolveNextCueDancers,
  summarizePrevCueCompare,
} from "./stagePrevCueCompare";
import { classifyMovementCostPct, describePrevCueChangeFact } from "./stageMovementGrade";
import { movementCostPct } from "./stageShapeGenerator";
import type { DancerSpot } from "../types/choreography";

function spot(
  id: string,
  x: number,
  y: number,
  colorIndex = 0
): DancerSpot {
  return { id, label: id, xPct: x, yPct: y, colorIndex };
}

describe("resolvePreviousCueDancers", () => {
  it("returns null on the first cue", () => {
    const p = createEmptyProject();
    const f = p.formations[0]!;
    p.cues = [{ id: "a", tStartSec: 0, tEndSec: 8, formationId: f.id }];
    expect(resolvePreviousCueDancers(p.cues, p.formations, "a")).toBeNull();
  });

  it("returns the previous cue formation dancers without sharing identity of the current cue", () => {
    const p = createEmptyProject();
    const fA = {
      ...p.formations[0]!,
      id: "fa",
      dancers: [spot("d1", 30, 40)],
    };
    const fB = {
      ...p.formations[0]!,
      id: "fb",
      dancers: [spot("d1", 70, 40)],
    };
    p.formations = [fA, fB];
    p.cues = [
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
      { id: "b", tStartSec: 8, tEndSec: 16, formationId: "fb" },
    ];
    const prev = resolvePreviousCueDancers(p.cues, p.formations, "b");
    expect(prev).toBe(fA.dancers);
    expect(prev![0]!.xPct).toBe(30);
  });
});

describe("resolvePreviousCueOrdinal", () => {
  it("returns null on the first cue and current-1 afterwards", () => {
    const p = createEmptyProject();
    p.cues = [
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
      { id: "b", tStartSec: 8, tEndSec: 16, formationId: "fb" },
    ];
    expect(resolvePreviousCueOrdinal(p.cues, "a")).toBeNull();
    expect(resolvePreviousCueOrdinal(p.cues, "b")).toBe(1);
  });
});

describe("resolveNextCueDancers", () => {
  it("returns the next cue formation dancers", () => {
    const p = createEmptyProject();
    const fA = {
      ...p.formations[0]!,
      id: "fa",
      dancers: [spot("d1", 30, 40)],
    };
    const fB = {
      ...p.formations[0]!,
      id: "fb",
      dancers: [spot("d1", 70, 40)],
    };
    p.formations = [fA, fB];
    p.cues = [
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
      { id: "b", tStartSec: 8, tEndSec: 16, formationId: "fb" },
    ];
    expect(resolveNextCueDancers(p.cues, p.formations, "a")).toBe(fB.dancers);
    expect(resolveNextCueDancers(p.cues, p.formations, "b")).toBeNull();
  });
});

describe("resolveCueDancersById", () => {
  it("returns dancers for the named cue", () => {
    const p = createEmptyProject();
    const fA = {
      ...p.formations[0]!,
      id: "fa",
      dancers: [spot("d1", 11, 22)],
    };
    p.formations = [fA];
    p.cues = [{ id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" }];
    expect(resolveCueDancersById(p.cues, p.formations, "a")).toBe(fA.dancers);
    expect(resolveCueDancersById(p.cues, p.formations, "missing")).toBeNull();
  });
});

describe("listTravelMatchCueOptions", () => {
  it("labels previous/next and lists other cues for picking", () => {
    const p = createEmptyProject();
    const mk = (id: string, x: number) => ({
      ...p.formations[0]!,
      id,
      dancers: [spot("d1", x, 40)],
    });
    p.formations = [mk("fa", 10), mk("fb", 50), mk("fc", 90)];
    p.cues = [
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
      { id: "b", tStartSec: 8, tEndSec: 16, formationId: "fb" },
      { id: "c", tStartSec: 16, tEndSec: 24, formationId: "fc" },
    ];
    const opts = listTravelMatchCueOptions(p.cues, p.formations, "b");
    expect(opts.map((o) => o.kind)).toEqual(["previous", "next"]);
    expect(opts[0]).toMatchObject({
      cueId: "a",
      label: "前のキュー（1）",
    });
    expect(opts[1]).toMatchObject({
      cueId: "c",
      label: "次のキュー（3）",
    });
    expect(defaultTravelMatchCueId(opts)).toBe("a");

    const fromFirst = listTravelMatchCueOptions(p.cues, p.formations, "a");
    expect(fromFirst.map((o) => o.kind)).toEqual(["next", "other"]);
    expect(fromFirst[0]!.cueId).toBe("b");
    expect(fromFirst[1]).toMatchObject({
      cueId: "c",
      kind: "other",
      label: "キュー 3",
    });
    expect(defaultTravelMatchCueId(fromFirst)).toBe("b");
  });
});

describe("listTravelMatchCueOptionsForInsert", () => {
  it("labels the cue before playhead as previous and after as next", () => {
    const p = createEmptyProject();
    const mk = (id: string, x: number) => ({
      ...p.formations[0]!,
      id,
      dancers: [spot("d1", x, 40)],
    });
    p.formations = [mk("fa", 10), mk("fb", 50), mk("fc", 90)];
    /** ギャップ 10〜14 に新規キューを挿す想定 */
    p.cues = [
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
      { id: "b", tStartSec: 8, tEndSec: 10, formationId: "fb" },
      { id: "c", tStartSec: 14, tEndSec: 24, formationId: "fc" },
    ];
    const opts = listTravelMatchCueOptionsForInsert(p.cues, p.formations, 12);
    expect(opts.find((o) => o.kind === "previous")?.cueId).toBe("b");
    expect(opts.find((o) => o.kind === "next")?.cueId).toBe("c");
    expect(defaultTravelMatchCueId(opts)).toBe("b");
  });
});

describe("buildPrevCueCompareMarks", () => {
  it("matches by dancer id, not array order", () => {
    const prev = [spot("a", 10, 10), spot("b", 90, 10)];
    const current = [spot("b", 90, 80), spot("a", 10, 80)];
    const marks = buildPrevCueCompareMarks({ prevDancers: prev, currentDancers: current });
    expect(marks.map((m) => m.dancerId).sort()).toEqual(["a", "b"]);
    expect(marks.find((m) => m.dancerId === "a")).toMatchObject({
      fromYPct: 10,
      toYPct: 80,
    });
  });

  it("omits people who barely moved", () => {
    const prev = [spot("a", 50, 50), spot("b", 20, 20)];
    const current = [spot("a", 50.2, 50.1), spot("b", 80, 20)];
    const marks = buildPrevCueCompareMarks({ prevDancers: prev, currentDancers: current });
    expect(marks.map((m) => m.dancerId)).toEqual(["b"]);
  });

  it("skips ids that are not in the current formation", () => {
    const prev = [spot("gone", 10, 10), spot("kept", 20, 20)];
    const current = [spot("kept", 80, 20)];
    const marks = buildPrevCueCompareMarks({ prevDancers: prev, currentDancers: current });
    expect(marks.map((m) => m.dancerId)).toEqual(["kept"]);
  });

  it("does not mutate input arrays", () => {
    const prev = [spot("a", 10, 10)];
    const current = [spot("a", 80, 10)];
    const prevCopy = prev.map((d) => ({ ...d }));
    const curCopy = current.map((d) => ({ ...d }));
    buildPrevCueCompareMarks({ prevDancers: prev, currentDancers: current });
    expect(prev).toEqual(prevCopy);
    expect(current).toEqual(curCopy);
  });
});

describe("summarizePrevCueCompare", () => {
  it("counts moved vs still by dancer id and reuses movementCostPct grades", () => {
    const prev = [
      spot("still", 50, 50),
      spot("small", 10, 10),
      spot("mid", 10, 10),
      spot("big", 10, 10),
      spot("gone", 0, 0),
    ];
    const current = [
      spot("big", 10, 50),
      spot("mid", 10, 25),
      spot("small", 16, 10),
      spot("still", 50.3, 50),
    ];
    const summary = summarizePrevCueCompare({
      prevDancers: prev,
      currentDancers: current,
    });
    expect(summary.matchedCount).toBe(4);
    expect(summary.movedCount).toBe(3);
    expect(summary.stillCount).toBe(1);
    expect(summary.smallCount + summary.mediumCount + summary.largeCount).toBe(
      3
    );
    expect(summary.smallCount).toBe(1);
    expect(summary.mediumCount).toBe(1);
    expect(summary.largeCount).toBe(1);
    expect(summary.maxMovePct).toBe(
      movementCostPct({ xPct: 10, yPct: 10 }, { xPct: 10, yPct: 50 })
    );
    expect(classifyMovementCostPct(summary.maxMovePct)).toBe("大");
    expect(
      buildPrevCueCompareMarks({ prevDancers: prev, currentDancers: current })
        .length
    ).toBe(summary.movedCount);
  });
});

describe("classifyMovementCostPct", () => {
  it("keeps the shared 8 / 25 display thresholds", () => {
    expect(classifyMovementCostPct(7.9)).toBe("小");
    expect(classifyMovementCostPct(8)).toBe("中");
    expect(classifyMovementCostPct(24.9)).toBe("中");
    expect(classifyMovementCostPct(25)).toBe("大");
  });
});

describe("describePrevCueChangeFact", () => {
  it("states size from max movementCostPct without judging good or bad", () => {
    expect(
      describePrevCueChangeFact({ movedCount: 0, maxMovePct: 0 })
    ).toBe("位置はほぼそのまま");
    expect(
      describePrevCueChangeFact({ movedCount: 2, maxMovePct: 7 })
    ).toBe("この変化は小さい");
    expect(
      describePrevCueChangeFact({ movedCount: 2, maxMovePct: 20 })
    ).toBe("この変化は中くらい");
    expect(
      describePrevCueChangeFact({ movedCount: 1, maxMovePct: 42 })
    ).toBe("この変化は大きい");
  });
});

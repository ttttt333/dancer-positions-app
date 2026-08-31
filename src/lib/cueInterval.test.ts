import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  applyCueWaveDragCommit,
  splitSharedCueFormations,
  expandShortCuesAfterAudioLoad,
  projectNeedsShortCueExpansion,
  cueActiveAtTime,
  migrateCuesFromRaw,
  duplicateCueAfterSourceInProject,
  cueNumberById,
} from "./cueInterval";
import { normalizeProject } from "./normalizeProject";
import type { Cue } from "../types/choreography";

describe("splitSharedCueFormations", () => {
  it("assigns unique formations when multiple cues share one formationId", () => {
    const base = createEmptyProject();
    const sharedFid = base.activeFormationId;
    const cue1 = {
      id: "cue-1",
      tStartSec: 0,
      tEndSec: 5,
      formationId: sharedFid,
    };
    const cue2 = {
      id: "cue-2",
      tStartSec: 5,
      tEndSec: 10,
      formationId: sharedFid,
    };
    const project = {
      ...base,
      formations: [
        {
          ...base.formations[0]!,
          id: sharedFid,
          dancers: [
            {
              id: "d1",
              label: "1",
              xPct: 50,
              yPct: 50,
              colorIndex: 0,
            },
          ],
        },
      ],
      cues: [cue1, cue2],
    };

    const next = splitSharedCueFormations(project);
    expect(next.cues[0]!.formationId).toBe(sharedFid);
    expect(next.cues[1]!.formationId).not.toBe(sharedFid);
    expect(next.cues[0]!.formationId).not.toBe(next.cues[1]!.formationId);
    expect(next.formations.length).toBe(2);
  });

  it("leaves project unchanged when each cue already has its own formation", () => {
    const base = createEmptyProject();
    const f1 = base.activeFormationId;
    const f2 = crypto.randomUUID();
    const project = {
      ...base,
      formations: [
        base.formations[0]!,
        { ...base.formations[0]!, id: f2, name: "F2" },
      ],
      cues: [
        { id: "c1", tStartSec: 0, tEndSec: 3, formationId: f1 },
        { id: "c2", tStartSec: 3, tEndSec: 6, formationId: f2 },
      ],
    };
    expect(splitSharedCueFormations(project)).toBe(project);
  });
});

describe("duplicateCueAfterSourceInProject", () => {
  function projectWithCueA(extraCues: Cue[] = []) {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const dancers = [
      { id: "d-sakura", label: "さくら", xPct: 30, yPct: 40, colorIndex: 2 },
      { id: "d-yuki", label: "ゆき", xPct: 50, yPct: 70, colorIndex: 4 },
    ];
    const cueA: Cue = {
      id: "cue-a",
      tStartSec: 0,
      tEndSec: 8,
      formationId: fid,
      name: "A",
    };
    return {
      base: {
        ...base,
        formations: [
          {
            ...base.formations[0]!,
            id: fid,
            name: "V字",
            dancers,
          },
        ],
        cues: [cueA, ...extraCues],
      },
      cueA,
      fid,
      dancers,
    };
  }

  it("inserts a cloned cue after A without changing A or overwriting the next cue", () => {
    const cueC: Cue = {
      id: "cue-c",
      tStartSec: 16,
      tEndSec: 24,
      formationId: "formation-c",
    };
    const { base, cueA, fid, dancers } = projectWithCueA([cueC]);
    const next = duplicateCueAfterSourceInProject(
      {
        ...base,
        formations: [
          ...base.formations,
          { id: "formation-c", name: "C", dancers: [] },
        ],
      },
      cueA,
      "cue-b",
      0,
      120
    );
    expect(next).not.toBeNull();
    const cueAAfter = next!.cues.find((c) => c.id === "cue-a")!;
    const cueB = next!.cues.find((c) => c.id === "cue-b")!;
    const cueCAfter = next!.cues.find((c) => c.id === "cue-c")!;
    expect(cueAAfter).toEqual(cueA);
    expect(cueCAfter.formationId).toBe("formation-c");
    expect(cueCAfter.tStartSec).toBe(16);
    expect(cueCAfter.tEndSec).toBe(24);
    expect(cueB.formationId).not.toBe(fid);
    expect(cueB.tStartSec).toBe(8);
    expect(next!.cues).toHaveLength(3);

    const cloned = next!.formations.find((f) => f.id === cueB.formationId)!;
    expect(cloned.dancers.map((d) => d.id)).toEqual(["d-sakura", "d-yuki"]);
    expect(cloned.dancers.map((d) => d.label)).toEqual(["さくら", "ゆき"]);
    expect(cloned.dancers.map((d) => d.colorIndex)).toEqual([2, 4]);
    expect(cloned.dancers.map((d) => ({ x: d.xPct, y: d.yPct }))).toEqual(
      dancers.map((d) => ({ x: d.xPct, y: d.yPct }))
    );
    expect(next!.formations.find((f) => f.id === fid)!.dancers).toEqual(dancers);
    expect(next!.activeFormationId).toBe(cloned.id);

    const moved = {
      ...next!,
      formations: next!.formations.map((f) =>
        f.id === cloned.id
          ? {
              ...f,
              dancers: f.dancers.map((d, i) =>
                i === 0 ? { ...d, xPct: 99 } : d
              ),
            }
          : f
      ),
    };
    expect(moved.formations.find((f) => f.id === fid)!.dancers[0]!.xPct).toBe(
      30
    );
    expect(
      moved.formations.find((f) => f.id === cloned.id)!.dancers[0]!.xPct
    ).toBe(99);
  });
});

describe("cueNumberById", () => {
  it("numbers cues by start time", () => {
    const cues: Cue[] = [
      { id: "b", tStartSec: 8, tEndSec: 16, formationId: "fb" },
      { id: "a", tStartSec: 0, tEndSec: 8, formationId: "fa" },
    ];
    expect(cueNumberById(cues, "a")).toBe(1);
    expect(cueNumberById(cues, "b")).toBe(2);
    expect(cueNumberById(cues, "missing")).toBeNull();
  });
});

describe("applyCueWaveDragCommit", () => {
  const adjacent: Cue[] = [
    { id: "a", tStartSec: 0, tEndSec: 10, formationId: "f1" },
    { id: "b", tStartSec: 10, tEndSec: 20, formationId: "f2" },
  ];

  it("extends cue end into adjacent cue by moving shared boundary", () => {
    const next = applyCueWaveDragCommit(
      adjacent,
      "a",
      "end",
      12,
      12,
      0,
      30
    );
    expect(next.find((c) => c.id === "a")).toMatchObject({
      tStartSec: 0,
      tEndSec: 12,
    });
    expect(next.find((c) => c.id === "b")).toMatchObject({
      tStartSec: 12,
      tEndSec: 20,
    });
  });

  it("moves cue block without overlap", () => {
    const withGap: Cue[] = [
      { id: "a", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "b", tStartSec: 15, tEndSec: 20, formationId: "f2" },
    ];
    const next = applyCueWaveDragCommit(
      withGap,
      "a",
      "move",
      2,
      12,
      0,
      30
    );
    expect(next.find((c) => c.id === "a")).toMatchObject({
      tStartSec: 2,
      tEndSec: 12,
    });
  });
});

describe("migrateCuesFromRaw", () => {
  it("preserves gap route and per-dancer custom paths", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const raw = [
      {
        id: "c1",
        formationId: fid,
        tStartSec: 0,
        tEndSec: 4,
      },
      {
        id: "c2",
        formationId: fid,
        tStartSec: 8,
        tEndSec: 12,
        gapApproachFromPrev: "kamite_half_via_audience",
        dancerCustomPaths: {
          d1: { cpX: 55, cpY: 40 },
        },
      },
    ];
    const cues = migrateCuesFromRaw(raw, base.formations);
    expect(cues[1]?.gapApproachFromPrev).toBe("kamite_half_via_audience");
    expect(cues[1]?.dancerCustomPaths).toEqual({ d1: { cpX: 55, cpY: 40 } });
  });
});

describe("normalizeProject gap movement", () => {
  it("keeps cue gap fields through cloud-save normalization", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const raw = {
      ...base,
      version: 3,
      cues: [
        {
          id: "c1",
          formationId: fid,
          tStartSec: 0,
          tEndSec: 4,
        },
        {
          id: "c2",
          formationId: fid,
          tStartSec: 8,
          tEndSec: 12,
          gapApproachFromPrev: "detour_bulge",
          dancerCustomPaths: { d1: { cpX: 30, cpY: 70 } },
        },
      ],
    };
    const normalized = normalizeProject(raw);
    expect(normalized.cues[1]?.gapApproachFromPrev).toBe("detour_bulge");
    expect(normalized.cues[1]?.dancerCustomPaths).toEqual({
      d1: { cpX: 30, cpY: 70 },
    });
  });
});

describe("projectNeedsShortCueExpansion", () => {
  it("returns false when cues have gaps", () => {
    const cues: Cue[] = [
      { id: "a", tStartSec: 0, tEndSec: 1, formationId: "f1" },
      { id: "b", tStartSec: 8, tEndSec: 9, formationId: "f2" },
    ];
    expect(projectNeedsShortCueExpansion(cues, 120)).toBe(false);
  });

  it("returns false when any cue is already long enough", () => {
    const cues: Cue[] = [
      { id: "a", tStartSec: 0, tEndSec: 3, formationId: "f1" },
      { id: "b", tStartSec: 3, tEndSec: 4, formationId: "f2" },
    ];
    expect(projectNeedsShortCueExpansion(cues, 120)).toBe(false);
  });

  it("returns true for abutting short silent-timeline cues", () => {
    const cues: Cue[] = [
      { id: "a", tStartSec: 0, tEndSec: 1, formationId: "f1" },
      { id: "b", tStartSec: 1, tEndSec: 2, formationId: "f2" },
    ];
    expect(projectNeedsShortCueExpansion(cues, 120)).toBe(true);
  });
});

describe("expandShortCuesAfterAudioLoad", () => {
  it("does not move cues that already have timeline gaps", () => {
    const project = {
      ...createEmptyProject(),
      cues: [
        { id: "a", tStartSec: 0, tEndSec: 1, formationId: "f1" },
        { id: "b", tStartSec: 10, tEndSec: 12, formationId: "f2" },
      ],
    };
    const next = expandShortCuesAfterAudioLoad(project, 120);
    expect(next.cues).toEqual(project.cues);
  });
});

describe("cueActiveAtTime", () => {
  const cues: Cue[] = [
    { id: "a", tStartSec: 0, tEndSec: 4, formationId: "f1" },
    { id: "b", tStartSec: 8, tEndSec: 12, formationId: "f2" },
  ];

  it("returns cue containing t", () => {
    expect(cueActiveAtTime(cues, 2)?.id).toBe("a");
    expect(cueActiveAtTime(cues, 10)?.id).toBe("b");
  });

  it("returns next cue during gap", () => {
    expect(cueActiveAtTime(cues, 6)?.id).toBe("b");
  });
});

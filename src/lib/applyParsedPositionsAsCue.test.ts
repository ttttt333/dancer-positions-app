import { describe, expect, it } from "vitest";
import {
  applyParsedPositionsAsCue,
  dancersFromParsedPositions,
} from "./applyParsedPositionsAsCue";
import { createEmptyProject } from "./projectDefaults";
import type { DancerSpot } from "../types/choreography";

function spot(
  id: string,
  label: string,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return {
    id,
    label,
    xPct: 40,
    yPct: 40,
    colorIndex: 1,
    crewMemberId: `crew-${id}`,
    ...extra,
  };
}

describe("dancersFromParsedPositions", () => {
  it("reuses existing dancer ids when photo names match", () => {
    const source = [
      spot("d-a", "佐藤"),
      spot("d-b", "鈴木"),
      spot("d-c", "高橋"),
    ];
    const next = dancersFromParsedPositions(
      [
        { name: "鈴木", x: 10, y: 20 },
        { name: "佐藤", x: 80, y: 70 },
      ],
      source
    );
    expect(next.map((d) => d.id)).toEqual(["d-b", "d-a"]);
    expect(next[0]).toMatchObject({
      id: "d-b",
      label: "鈴木",
      xPct: 10,
      yPct: 20,
      crewMemberId: "crew-d-b",
      colorIndex: 1,
    });
    expect(next[1]?.id).toBe("d-a");
  });

  it("gives unmatched names new ids and unique crewMemberId from roster", () => {
    const project = createEmptyProject();
    project.crews = [
      {
        id: "crew-1",
        name: "1組",
        members: [
          {
            id: "mem-hana",
            label: "花子",
            colorIndex: 2,
          },
        ],
      },
    ];
    const next = dancersFromParsedPositions(
      [{ name: "花子", x: 55, y: 60 }],
      [],
      project
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.id).not.toBe("mem-hana");
    expect(next[0]?.crewMemberId).toBe("mem-hana");
    expect(next[0]?.label).toBe("花子");
  });
});

describe("applyParsedPositionsAsCue", () => {
  it("keeps source dancer ids on the new cue so later loads/undo still target the same people", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const project = {
      ...base,
      formations: [
        {
          ...base.formations[0]!,
          id: fid,
          dancers: [spot("keep-me", "田中", { xPct: 12, yPct: 88 })],
        },
      ],
      cues: [{ id: "cue-a", tStartSec: 0, tEndSec: 5, formationId: fid }],
    };

    const applied = applyParsedPositionsAsCue(project, {
      positions: [{ name: "田中", x: 70, y: 25 }],
      tStartSec: 5,
      durationSec: 60,
    });
    expect(applied).not.toBeNull();
    const newFm = applied!.project.formations.find(
      (f) => f.id === applied!.result.formationId
    );
    expect(newFm?.dancers).toHaveLength(1);
    expect(newFm?.dancers[0]?.id).toBe("keep-me");
    expect(newFm?.dancers[0]?.xPct).toBe(70);
    expect(applied!.project.activeFormationId).toBe(applied!.result.formationId);
    expect(applied!.project.cues.map((c) => c.id)).toContain(
      applied!.result.cueId
    );
  });
});

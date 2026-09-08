import { describe, expect, it } from "vitest";
import type { Formation } from "../../types/choreography";
import type { MusicSection } from "../../types/audioAnalysis";
import {
  applySectionKeyframesToProject,
  generateAutoKeyframes,
  projectAllowsSilentAutoKeyframes,
} from "./generateAutoKeyframes";

const seed: Formation = {
  id: "seed",
  name: "Base",
  dancers: [
    { id: "d1", label: "1", xPct: 50, yPct: 50, colorIndex: 0 },
  ],
};

const sections: MusicSection[] = [
  {
    id: "1",
    type: "intro",
    label: "イントロ",
    startTime: 0,
    endTime: 8,
    color: "#6B7280",
  },
  {
    id: "2",
    type: "verse",
    label: "Aメロ",
    startTime: 8,
    endTime: 24,
    color: "#3B82F6",
  },
  {
    id: "3",
    type: "chorus",
    label: "サビ",
    startTime: 32,
    endTime: 48,
    color: "#EF4444",
  },
];

describe("generateAutoKeyframes", () => {
  it("creates one cue per section with dancer-facing names", () => {
    const { cues, formations } = generateAutoKeyframes({
      sections,
      seedFormation: seed,
      durationSec: 64,
    });
    expect(formations).toHaveLength(3);
    expect(cues).toHaveLength(3);
    expect(cues[0]!.tStartSec).toBe(0);
    expect(cues[1]!.tStartSec).toBe(8);
    expect(cues[2]!.tStartSec).toBe(32);
    expect(cues[0]!.name).toMatch(/^イントロ/);
    expect(cues[2]!.name).toMatch(/^サビ/);
    expect(formations[1]!.name).toBe("Aメロ");
  });

  it("inserts a leading cue when first section starts later", () => {
    const late: MusicSection[] = [
      {
        id: "v",
        type: "verse",
        label: "Aメロ",
        startTime: 4,
        endTime: 20,
        color: "#3B82F6",
      },
    ];
    const { cues } = generateAutoKeyframes({
      sections: late,
      seedFormation: seed,
      durationSec: 40,
    });
    expect(cues[0]!.tStartSec).toBe(0);
    expect(cues[0]!.name).toMatch(/^開始/);
    expect(cues[1]!.tStartSec).toBe(4);
  });
});

describe("projectAllowsSilentAutoKeyframes", () => {
  it("allows when 0–1 cues", () => {
    expect(
      projectAllowsSilentAutoKeyframes({
        cues: [],
        formations: [seed],
        activeFormationId: seed.id,
        viewMode: "edit",
      } as never)
    ).toBe(true);
    expect(
      projectAllowsSilentAutoKeyframes({
        cues: [
          {
            id: "c1",
            tStartSec: 0,
            tEndSec: 10,
            formationId: seed.id,
          },
        ],
        formations: [seed],
        activeFormationId: seed.id,
        viewMode: "edit",
      } as never)
    ).toBe(true);
  });

  it("blocks when multiple cues exist", () => {
    expect(
      projectAllowsSilentAutoKeyframes({
        cues: [
          { id: "a", tStartSec: 0, tEndSec: 5, formationId: seed.id },
          { id: "b", tStartSec: 5, tEndSec: 10, formationId: seed.id },
        ],
        formations: [seed],
        activeFormationId: seed.id,
        viewMode: "edit",
      } as never)
    ).toBe(false);
  });
});

describe("applySectionKeyframesToProject", () => {
  it("replaces cue list and drops old cue formations", () => {
    const oldFm: Formation = { ...seed, id: "old-fm", name: "Old" };
    const slice = generateAutoKeyframes({
      sections,
      seedFormation: seed,
      durationSec: 64,
    });
    const next = applySectionKeyframesToProject(
      {
        cues: [
          { id: "old", tStartSec: 0, tEndSec: 60, formationId: "old-fm" },
        ],
        formations: [oldFm, seed],
        activeFormationId: "old-fm",
        viewMode: "edit",
      } as never,
      slice
    );
    expect(next.cues).toHaveLength(3);
    expect(next.formations.some((f) => f.id === "old-fm")).toBe(false);
    expect(next.formations).toHaveLength(3 + 1); // seed kept + 3 new
  });
});

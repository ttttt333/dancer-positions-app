import { describe, expect, it } from "vitest";
import type { ChoreographyProjectJson, Formation } from "../../types/choreography";
import type { MusicSection } from "../../types/audioAnalysis";
import {
  applySectionFormationPatterns,
  DEFAULT_SECTION_FORMATION_PATTERNS,
  sectionTypesPresent,
} from "./sectionFormationPatterns";

function makeFormation(id: string, n: number): Formation {
  return {
    id,
    name: id,
    dancers: Array.from({ length: n }, (_, i) => ({
      id: `${id}-d${i}`,
      label: String(i + 1),
      xPct: 20 + i * 10,
      yPct: 50,
      colorIndex: i % 12,
    })),
  };
}

describe("applySectionFormationPatterns", () => {
  it("applies vee to chorus cue and two_rows to verse cue", () => {
    const verseFm = makeFormation("fv", 6);
    const chorusFm = makeFormation("fc", 6);
    const project = {
      viewMode: "edit",
      activeFormationId: "fv",
      dancerSpacingMm: 900,
      stageWidthMm: 9000,
      formations: [verseFm, chorusFm],
      cues: [
        {
          id: "c1",
          tStartSec: 8,
          tEndSec: 24,
          formationId: "fv",
          name: "Aメロ",
        },
        {
          id: "c2",
          tStartSec: 32,
          tEndSec: 48,
          formationId: "fc",
          name: "サビ",
        },
      ],
    } as unknown as ChoreographyProjectJson;

    const sections: MusicSection[] = [
      {
        id: "s1",
        type: "verse",
        label: "Aメロ",
        startTime: 8,
        endTime: 24,
        color: "#3B82F6",
      },
      {
        id: "s2",
        type: "chorus",
        label: "サビ",
        startTime: 32,
        endTime: 48,
        color: "#EF4444",
      },
    ];

    const { project: next, updatedFormationCount } =
      applySectionFormationPatterns(project, sections);

    expect(updatedFormationCount).toBe(2);
    const v = next.formations.find((f) => f.id === "fv")!;
    const c = next.formations.find((f) => f.id === "fc")!;
    // 位置が変わっている（横一列のままではない）
    const vSpread = Math.max(...v.dancers.map((d) => d.yPct)) -
      Math.min(...v.dancers.map((d) => d.yPct));
    const cSpread = Math.max(...c.dancers.map((d) => d.yPct)) -
      Math.min(...c.dancers.map((d) => d.yPct));
    expect(vSpread).toBeGreaterThan(1);
    expect(cSpread).toBeGreaterThan(1);
    // ID は維持
    expect(v.dancers.map((d) => d.id).sort()).toEqual(
      verseFm.dancers.map((d) => d.id).sort()
    );
  });

  it("lists present section types in display order", () => {
    expect(
      sectionTypesPresent([
        {
          id: "a",
          type: "chorus",
          label: "サビ",
          startTime: 0,
          endTime: 1,
          color: "r",
        },
        {
          id: "b",
          type: "verse",
          label: "A",
          startTime: 1,
          endTime: 2,
          color: "b",
        },
      ])
    ).toEqual(["verse", "chorus"]);
  });

  it("exposes dancer-facing defaults", () => {
    expect(DEFAULT_SECTION_FORMATION_PATTERNS.chorus).toBe("vee");
    expect(DEFAULT_SECTION_FORMATION_PATTERNS.verse).toBe("two_rows");
  });
});

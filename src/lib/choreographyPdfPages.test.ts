import { describe, expect, it } from "vitest";
import { buildChoreographyPdfPages, formatSecDot } from "./choreographyPdfPages";
import { createEmptyProject } from "./projectDefaults";
import type { ChoreographyProjectJson } from "../types/choreography";

describe("formatSecDot", () => {
  it("formats seconds with hundredths", () => {
    expect(formatSecDot(0)).toBe("00.00");
    expect(formatSecDot(2.4)).toBe("02.40");
    expect(formatSecDot(2.42)).toBe("02.42");
  });
});

describe("buildChoreographyPdfPages", () => {
  it("uses cues when present", () => {
    const base = createEmptyProject();
    const f = base.formations[0]!;
    const project: ChoreographyProjectJson = {
      ...base,
      pieceTitle: "テスト",
      formations: [
        {
          ...f,
          dancers: [
            {
              id: "d1",
              label: "A",
              xPct: 40,
              yPct: 50,
              colorIndex: 0,
            },
          ],
        },
      ],
      cues: [
        {
          id: "c1",
          name: "Cue 1",
          formationId: f.id,
          tStartSec: 0,
          tEndSec: 2.4,
        },
        {
          id: "c2",
          name: "Cue 2",
          formationId: f.id,
          tStartSec: 2.4,
          tEndSec: 5,
        },
      ],
    };
    const pages = buildChoreographyPdfPages(project);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.timeLabel).toBe("00.00-02.40");
    expect(pages[0]?.title).toBe("Cue 1");
    expect(pages[0]?.formation.dancers).toHaveLength(1);
  });

  it("falls back to formations when no cues", () => {
    const base = createEmptyProject();
    const pages = buildChoreographyPdfPages(base);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0]?.timeLabel).toBe("—");
  });
});

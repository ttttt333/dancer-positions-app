import { describe, expect, it } from "vitest";
import {
  buildChoreographyPdfPages,
  formatPdfClock,
  formatPdfTimeRange,
  formatSecDot,
} from "./choreographyPdfPages";
import { createEmptyProject } from "./projectDefaults";
import type { ChoreographyProjectJson } from "../types/choreography";

describe("formatSecDot", () => {
  it("formats seconds with hundredths", () => {
    expect(formatSecDot(0)).toBe("00.00");
    expect(formatSecDot(2.4)).toBe("02.40");
    expect(formatSecDot(2.42)).toBe("02.42");
  });
});

describe("formatPdfClock / formatPdfTimeRange", () => {
  it("formats as m:ss", () => {
    expect(formatPdfClock(0)).toBe("0:00");
    expect(formatPdfClock(105)).toBe("1:45");
    expect(formatPdfClock(18.4)).toBe("0:18");
  });

  it("joins with 〜", () => {
    expect(formatPdfTimeRange(0, 105)).toBe("0:00〜1:45");
  });
});

describe("buildChoreographyPdfPages", () => {
  it("uses cue index and readable time range", () => {
    const base = createEmptyProject();
    const f = base.formations[0]!;
    const project: ChoreographyProjectJson = {
      ...base,
      pieceTitle: "テスト",
      formations: [
        {
          ...f,
          name: "フォーメーション１・コピー・コピー・コピー",
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
          name: "コピー・コピー",
          formationId: f.id,
          tStartSec: 0,
          tEndSec: 105,
        },
        {
          id: "c2",
          name: "Cue 2",
          formationId: f.id,
          tStartSec: 105,
          tEndSec: 120,
        },
      ],
    };
    const pages = buildChoreographyPdfPages(project);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.timeLabel).toBe("0:00〜1:45");
    expect(pages[0]?.title).toBe("キュー 1");
    expect(pages[1]?.title).toBe("キュー 2");
    expect(pages[0]?.formation.dancers).toHaveLength(1);
  });

  it("falls back to formations when no cues", () => {
    const base = createEmptyProject();
    const pages = buildChoreographyPdfPages(base);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0]?.timeLabel).toBe("—");
    expect(pages[0]?.title).toBe("フォーメーション 1");
  });
});

import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { buildCueSheetCsv } from "./shareProjectLinks";

describe("buildCueSheetCsv", () => {
  it("returns header only when there are no cues", () => {
    const project = createEmptyProject();
    expect(buildCueSheetCsv(project)).toBe("cue,name,start,end,dancers\r\n");
  });

  it("writes cue number, quoted name, clock times, and dancer count", () => {
    const project = createEmptyProject();
    const fid = project.formations[0].id;
    project.formations[0].dancers = [
      { id: "d1", label: "A", xPct: 10, yPct: 20, colorIndex: 0 },
      { id: "d2", label: "B", xPct: 30, yPct: 40, colorIndex: 1 },
    ];
    project.cues = [
      {
        id: "c1",
        tStartSec: 0,
        tEndSec: 12.4,
        formationId: fid,
        name: "Intro, A",
      },
    ];
    const csv = buildCueSheetCsv(project, { cueFallback: (n) => `Cue ${n}` });
    expect(csv).toBe('cue,name,start,end,dancers\r\n1,"Intro, A",0:00,0:12,2\r\n');
  });

  it("falls back to the labeled cue name when the cue has no name", () => {
    const project = createEmptyProject();
    project.cues = [
      {
        id: "c1",
        tStartSec: 60,
        tEndSec: 75,
        formationId: "missing",
      },
    ];
    const csv = buildCueSheetCsv(project, { cueFallback: (n) => `キュー ${n}` });
    expect(csv).toContain("1,キュー 1,1:00,1:15,0");
  });
});

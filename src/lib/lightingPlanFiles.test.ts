import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { normalizeProject } from "./normalizeProject";
import {
  lightingPlanSpotPoint,
  placeLightingPlanCircle,
  setLightingPlanCircleNumber,
  setLightingPlanCueTime,
  setLightingPlanRowHeight,
  toggleLightingPlanEdge,
  withCuePlanText,
} from "./lightingPlan";
import {
  applyLightingPlanFile,
  captureLightingPlanFile,
  listLightingPlanLibrary,
  overwriteLightingPlanLibraryItem,
  parseLightingPlanFile,
  saveLightingPlanLibraryItem,
} from "./lightingPlanFiles";

describe("lighting plan files", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores marks, row height, and sheet times without moving standing cues", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    let project = {
      ...base,
      cues: [
        { id: "c1", formationId: fid, tStartSec: 0, tEndSec: 9 },
        { id: "c2", formationId: fid, tStartSec: 9, tEndSec: 20 },
      ],
    };
    project = withCuePlanText(project, "c1", {
      lightingRequest: "赤系で",
      lightingRequestMarks: [{ start: 0, end: 2, bold: true, color: "#dc2626", size: 40 }],
    });
    project = setLightingPlanCueTime(project, "c1", 1, 8);
    project = setLightingPlanRowHeight(project, "c1", 220);
    project = {
      ...project,
      lightingPlan: { ...project.lightingPlan, className: "オープニング" },
    };

    const file = captureLightingPlanFile(project, "オープニング");
    const parsed = parseLightingPlanFile(JSON.parse(JSON.stringify(file)));
    expect(parsed?.cues[0]?.lightingRequestMarks).toEqual([
      { start: 0, end: 2, bold: true, size: 40, color: "#dc2626" },
    ]);

    const fresh = {
      ...base,
      cues: [
        { id: "c1", formationId: fid, tStartSec: 0, tEndSec: 9 },
        { id: "c2", formationId: fid, tStartSec: 9, tEndSec: 20 },
      ],
    };
    const applied = applyLightingPlanFile(fresh, parsed!);
    expect(applied.matchedById).toBe(2);
    expect(applied.matchedByOrder).toBe(0);
    expect(applied.project.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 9, lightingRequest: "赤系で" });
    expect(applied.project.cues[0]?.lightingRequestMarks?.[0]).toMatchObject({ bold: true, size: 40 });
    expect(applied.project.lightingPlan?.cueTimes?.c1).toEqual({ tStartSec: 1, tEndSec: 8 });
    expect(applied.project.lightingPlan?.rowHeights?.c1).toBe(220);
    expect(applied.project.lightingPlan?.className).toBe("オープニング");

    const normalized = normalizeProject(applied.project);
    expect(normalized.cues[0]?.tStartSec).toBe(0);
    expect(normalized.lightingPlan?.rowHeights?.c1).toBe(220);
    expect(normalized.cues[0]?.lightingRequestMarks?.[0]?.color).toBe("#dc2626");
  });

  it("matches a file from another project by cue order", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const saved = captureLightingPlanFile(
      {
        ...base,
        cues: [
          { id: "old-a", formationId: fid, tStartSec: 0, tEndSec: 4, lightingRequest: "赤" },
          { id: "old-b", formationId: fid, tStartSec: 4, tEndSec: 8, lightingRequest: "青" },
        ],
      },
      "他作品"
    );
    const current = {
      ...base,
      cues: [
        { id: "new-a", formationId: fid, tStartSec: 3, tEndSec: 6 },
        { id: "new-b", formationId: fid, tStartSec: 6, tEndSec: 9 },
      ],
    };
    const applied = applyLightingPlanFile(current, saved);
    expect(applied.matchedById).toBe(0);
    expect(applied.matchedByOrder).toBe(2);
    expect(applied.project.cues.find((cue) => cue.id === "new-a")?.lightingRequest).toBe("赤");
    expect(applied.project.cues.find((cue) => cue.id === "new-b")?.lightingRequest).toBe("青");
    expect(applied.project.cues.find((cue) => cue.id === "new-a")).toMatchObject({
      tStartSec: 3,
      tEndSec: 6,
    });
  });

  it("keeps formation drawings through save, overwrite, and recall", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    let source = {
      ...base,
      cues: [
        { id: "old-a", formationId: fid, tStartSec: 0, tEndSec: 4 },
        { id: "old-b", formationId: fid, tStartSec: 4, tEndSec: 8 },
      ],
    };
    source = placeLightingPlanCircle(source, "old-a", lightingPlanSpotPoint("center"));
    source = setLightingPlanCircleNumber(source, "old-a", "d1", "3");
    source = toggleLightingPlanEdge(source, "old-a", "kamite");
    const file = captureLightingPlanFile(source, "図");
    const parsed = parseLightingPlanFile(JSON.parse(JSON.stringify(file)));
    expect(parsed?.plan.drawings?.["old-a"]).toEqual([
      { id: "d1", kind: "circle", xPct: 50, yPct: 50, number: "3" },
      { id: "d2", kind: "edge", edge: "kamite" },
    ]);

    const current = {
      ...base,
      cues: [
        { id: "new-a", formationId: fid, tStartSec: 1, tEndSec: 5 },
        { id: "new-b", formationId: fid, tStartSec: 5, tEndSec: 9 },
      ],
    };
    const applied = applyLightingPlanFile(current, parsed!);
    expect(applied.project.cues.find((cue) => cue.id === "new-a")).toMatchObject({
      tStartSec: 1,
      tEndSec: 5,
    });
    expect(applied.project.lightingPlan?.drawings?.["new-a"]).toEqual([
      { id: "d1", kind: "circle", xPct: 50, yPct: 50, number: "3" },
      { id: "d2", kind: "edge", edge: "kamite" },
    ]);
    expect(applied.project.formations).toBe(current.formations);

    const normalized = normalizeProject(applied.project);
    expect(normalized.lightingPlan?.drawings?.["new-a"]?.[0]).toMatchObject({
      kind: "circle",
      number: "3",
    });

    const saved = saveLightingPlanLibraryItem("図", captureLightingPlanFile(normalized, "図"));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const overwritten = overwriteLightingPlanLibraryItem(
      saved.item.id,
      captureLightingPlanFile(
        toggleLightingPlanEdge(normalized, "new-a", "front"),
        "図"
      )
    );
    expect(overwritten.ok).toBe(true);
    const listed = listLightingPlanLibrary();
    expect(listed[0]?.file.plan.drawings?.["new-a"]?.some((mark) => mark.kind === "edge" && mark.edge === "front")).toBe(
      true
    );
  });

  it("saves a named plan and overwrites that same name slot", () => {
    const base = createEmptyProject();
    const first = captureLightingPlanFile(base, "一曲目");
    const saved = saveLightingPlanLibraryItem("一曲目", first);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const again = captureLightingPlanFile(
      { ...base, lightingPlan: { className: "改訂" } },
      "一曲目"
    );
    const overwritten = overwriteLightingPlanLibraryItem(saved.item.id, again);
    expect(overwritten.ok).toBe(true);
    const listed = listLightingPlanLibrary();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.file.plan.className).toBe("改訂");
    expect(listed[0]?.id).toBe(saved.item.id);
  });
});

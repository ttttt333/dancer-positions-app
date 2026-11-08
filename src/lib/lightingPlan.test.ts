import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { migrateCuesFromRaw } from "./cueInterval";
import { normalizeProject } from "./normalizeProject";
import {
  buildLightingPlanDocument,
  compactLightingPlan,
  deleteLightingPlanMark,
  formatLightingRange,
  formationSketchPlot,
  hitLightingPlanMark,
  lightingPlanEdgeAt,
  lightingPlanHeading,
  lightingPlanSpotPoint,
  moveLightingPlanCircle,
  omitCueFromLightingPlan,
  formatLightingPlanPlayhead,
  placeLightingPlanCircle,
  planClockFromParts,
  planClockParts,
  lightingPlanCueIdAtTime,
  parseLightingPlanClock,
  restoreOmittedLightingPlanCues,
  setLightingPlanCircleNumber,
  setLightingPlanCueTime,
  toggleLightingPlanEdge,
  withCuePlanText,
  withLightingPlan,
} from "./lightingPlan";

describe("lighting plan document", () => {
  it("shows the playhead in tenths and finds the cue under it", () => {
    expect(formatLightingPlanPlayhead(0)).toBe("0:00.0");
    expect(formatLightingPlanPlayhead(17.46)).toBe("0:17.4");
    expect(formatLightingPlanPlayhead(65.09)).toBe("1:05.0");
    const rows = [
      { cueId: "a", tStartSec: 0, tEndSec: 17 },
      { cueId: "b", tStartSec: 22, tEndSec: 24 },
      { cueId: "c", tStartSec: 24, tEndSec: 24 },
    ];
    expect(lightingPlanCueIdAtTime(rows, 10)).toBe("a");
    expect(lightingPlanCueIdAtTime(rows, 17)).toBe("");
    expect(lightingPlanCueIdAtTime(rows, 23)).toBe("b");
    expect(lightingPlanCueIdAtTime(rows, 24.1)).toBe("c");
  });

  it("splits a clock into minute and second dropdowns", () => {
    expect(planClockParts(17.4)).toEqual({ minutes: 0, seconds: 17 });
    expect(planClockParts(65)).toEqual({ minutes: 1, seconds: 5 });
    expect(planClockFromParts(1, 5)).toBe(65);
    expect(planClockFromParts(2, 75)).toBe(2 * 60 + 59);
  });

  it("formats cue ranges like the recital sheet", () => {
    expect(formatLightingRange(0, 9)).toBe("0:00 ~ 0:09");
    expect(formatLightingRange(185, 205)).toBe("3:05 ~ 3:25");
  });

  it("keeps the heading when the title already says 照明プラン", () => {
    expect(lightingPlanHeading("")).toBe("照明プラン");
    expect(lightingPlanHeading("第19回 S.O.P発表会")).toBe(
      "第19回 S.O.P発表会 照明プラン"
    );
    expect(lightingPlanHeading("第19回 照明プラン")).toBe("第19回 照明プラン");
  });

  it("drops an empty plan", () => {
    expect(compactLightingPlan({ eventTitle: "  ", pinSpot: undefined })).toBeUndefined();
  });

  it("builds header fields and per-cue notes from the project", () => {
    const base = createEmptyProject();
    const formation = base.formations[0]!;
    formation.dancers = [
      { id: "d1", label: "A", xPct: 50, yPct: 40, colorIndex: 0 },
      { id: "d2", label: "B", xPct: 30, yPct: 70, colorIndex: 1 },
    ];
    let project = withLightingPlan(
      {
        ...base,
        pieceTitle: "BLOOM",
        pieceDancerCount: 47,
        cues: [
          {
            id: "c1",
            formationId: formation.id,
            tStartSec: 0,
            tEndSec: 9,
            lightingRequest: "赤系",
            note: "センター",
          },
          {
            id: "c2",
            formationId: formation.id,
            tStartSec: 9,
            tEndSec: 185,
            name: "サビ",
          },
        ],
      },
      {
        eventTitle: "第19回 S.O.P発表会",
        programOrder: "1",
        programSub: "1",
        presetMark: "1",
        pinSpot: "あり",
        className: "オープニング",
        costumeBottom: "ブルー",
        costumeTop: "白シャツ",
        atmosphere: "かっこよくサビは明るく",
        points: "初めのSS",
      }
    );
    project = withCuePlanText(project, "c2", {
      lightingRequest: "黄色など色を増やして",
    });

    const doc = buildLightingPlanDocument(project);
    expect(doc.heading).toBe("第19回 S.O.P発表会 照明プラン");
    expect(doc.songTitle).toBe("BLOOM");
    expect(doc.timeLabel).toBe("3:05");
    expect(doc.headcountLabel).toBe("47");
    expect(doc.pinSpotLabel).toBe("あり");
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[0]).toMatchObject({
      number: 1,
      timeLabel: "0:00 ~ 0:09",
      note: "センター",
      lightingRequest: "赤系",
      dancerCount: 2,
    });
    expect(doc.rows[1]).toMatchObject({
      number: 2,
      name: "サビ",
      lightingRequest: "黄色など色を増やして",
    });
  });

  it("keeps a trailing space or newline while the sheet is being typed", () => {
    const base = createEmptyProject();
    const cueId = "c1";
    const project = withCuePlanText(
      {
        ...base,
        cues: [
          {
            id: cueId,
            formationId: base.activeFormationId,
            tStartSec: 0,
            tEndSec: 4,
          },
        ],
      },
      cueId,
      { note: "センター\n", lightingRequest: "赤系 ", name: "サビ " }
    );
    expect(project.cues[0]?.note).toBe("センター\n");
    expect(project.cues[0]?.lightingRequest).toBe("赤系 ");
    expect(project.cues[0]?.name).toBe("サビ ");
    const titled = withLightingPlan(project, { eventTitle: "第19回 " });
    expect(titled.lightingPlan?.eventTitle).toBe("第19回 ");
    const doc = buildLightingPlanDocument(titled);
    expect(doc.rows[0]?.note).toBe("センター");
    expect(doc.rows[0]?.lightingRequest).toBe("赤系");
    expect(doc.heading).toBe("第19回 照明プラン");
  });

  it("uses the piece title when the plan has no song title", () => {
    const base = createEmptyProject();
    const doc = buildLightingPlanDocument({ ...base, pieceTitle: "BLOOM" });
    expect(doc.songTitle).toBe("BLOOM");
    expect(doc.timeLabel).toBe("");
  });
});

describe("lighting plan persistence", () => {
  it("keeps cue lighting text and the plan header through normalize", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const normalized = normalizeProject({
      ...base,
      lightingPlan: {
        eventTitle: "第19回 S.O.P発表会",
        pinSpot: "maybe",
        className: "オープニング",
        extra: true,
      },
      cues: [
        {
          id: "c1",
          formationId: fid,
          tStartSec: 0,
          tEndSec: 9,
          note: "センターへそ",
          lightingRequest: "  赤系でお願いします  ",
        },
      ],
    });
    expect(normalized.lightingPlan).toEqual({
      eventTitle: "第19回 S.O.P発表会",
      className: "オープニング",
    });
    expect(normalized.cues[0]?.note).toBe("センターへそ");
    expect(normalized.cues[0]?.lightingRequest).toBe("赤系でお願いします");
  });

  it("changes sheet times without moving the standing cue", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const start = {
      ...base,
      cues: [
        {
          id: "c1",
          formationId: fid,
          tStartSec: 0,
          tEndSec: 17,
        },
        {
          id: "c2",
          formationId: fid,
          tStartSec: 22,
          tEndSec: 40,
          name: "サビ",
        },
      ],
    };
    const next = setLightingPlanCueTime(start, "c1", 90, 120);
    expect(next.cues).toBe(start.cues);
    expect(next.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 17 });
    expect(next.lightingPlan?.cueTimes).toEqual({
      c1: { tStartSec: 90, tEndSec: 120 },
    });
    const doc = buildLightingPlanDocument(next);
    expect(doc.rows.map((row) => row.cueId)).toEqual(["c2", "c1"]);
    expect(doc.rows[0]).toMatchObject({ number: 1, timeLabel: "0:22 ~ 0:40", name: "サビ" });
    expect(doc.rows[1]).toMatchObject({ number: 2, timeLabel: "1:30 ~ 2:00" });
    expect(doc.timeLabel).toBe("2:00");

    const cleared = setLightingPlanCueTime(next, "c1", 0, 17);
    expect(cleared.lightingPlan?.cueTimes).toBeUndefined();
    expect(cleared.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 17 });
  });

  it("rejects a window that does not move forward", () => {
    const base = createEmptyProject();
    const start = {
      ...base,
      cues: [
        {
          id: "c1",
          formationId: base.activeFormationId,
          tStartSec: 0,
          tEndSec: 9,
        },
      ],
    };
    expect(setLightingPlanCueTime(start, "c1", 10, 10)).toBe(start);
    expect(parseLightingPlanClock("")).toBeNull();
    expect(parseLightingPlanClock("-1")).toBeNull();
    expect(parseLightingPlanClock("1:30")).toBe(90);
    expect(parseLightingPlanClock("17")).toBe(17);
  });

  it("omits a sheet row and can put it back without deleting the cue", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const start = withLightingPlan(
      {
        ...base,
        cues: [
          { id: "c1", formationId: fid, tStartSec: 0, tEndSec: 17 },
          { id: "c2", formationId: fid, tStartSec: 22, tEndSec: 40 },
        ],
      },
      { className: "オープニング" }
    );
    const timed = setLightingPlanCueTime(start, "c1", 5, 12);
    const omitted = omitCueFromLightingPlan(timed, "c1");
    expect(omitted.cues).toBe(start.cues);
    expect(omitted.cues).toHaveLength(2);
    expect(omitted.lightingPlan?.omittedCueIds).toEqual(["c1"]);
    expect(omitted.lightingPlan?.cueTimes).toBeUndefined();
    expect(omitted.lightingPlan?.className).toBe("オープニング");
    const doc = buildLightingPlanDocument(omitted);
    expect(doc.rows.map((row) => row.cueId)).toEqual(["c2"]);
    expect(doc.rows[0]?.number).toBe(1);
    expect(doc.timeLabel).toBe("0:40");

    const again = omitCueFromLightingPlan(omitted, "c1");
    expect(again.lightingPlan?.omittedCueIds).toEqual(["c1"]);

    const restored = restoreOmittedLightingPlanCues(omitted);
    expect(restored.cues).toBe(start.cues);
    expect(restored.lightingPlan?.omittedCueIds).toBeUndefined();
    expect(buildLightingPlanDocument(restored).rows).toHaveLength(2);
    expect(buildLightingPlanDocument(restored).rows[0]?.timeLabel).toBe("0:00 ~ 0:17");
  });

  it("keeps sheet times and omitted rows when the header is edited or reloaded", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const project = withLightingPlan(
      {
        ...base,
        cues: [{ id: "c1", formationId: fid, tStartSec: 0, tEndSec: 17 }],
        lightingPlan: {
          className: "オープニング",
          cueTimes: { c1: { tStartSec: 30, tEndSec: 45 } },
          omittedCueIds: ["gone"],
        },
      },
      { eventTitle: "第19回 " }
    );
    expect(project.lightingPlan?.cueTimes).toEqual({
      c1: { tStartSec: 30, tEndSec: 45 },
    });
    expect(project.lightingPlan?.omittedCueIds).toEqual(["gone"]);
    expect(project.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 17 });

    const normalized = normalizeProject(project);
    expect(normalized.lightingPlan?.cueTimes).toEqual({
      c1: { tStartSec: 30, tEndSec: 45 },
    });
    expect(normalized.lightingPlan?.omittedCueIds).toEqual(["gone"]);
    expect(normalized.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 17 });
    const doc = buildLightingPlanDocument(normalized);
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({ timeLabel: "0:30 ~ 0:45" });
    expect(doc.timeLabel).toBe("0:45");
  });

  it("keeps lightingRequest when migrating raw cues", () => {
    const base = createEmptyProject();
    const cues = migrateCuesFromRaw(
      [
        {
          id: "c1",
          formationId: base.activeFormationId,
          tStartSec: 0,
          tEndSec: 4,
          lightingRequest: "ピンスポ",
        },
      ],
      base.formations
    );
    expect(cues[0]?.lightingRequest).toBe("ピンスポ");
  });

  it("places a circle, a number, and an edge, then round-trips normalize", () => {
    const base = createEmptyProject();
    const fid = base.activeFormationId;
    const dancer = base.formations[0]?.dancers[0];
    const start = {
      ...base,
      cues: [{ id: "c1", formationId: fid, tStartSec: 0, tEndSec: 9 }],
    };
    const center = lightingPlanSpotPoint("center");
    const kamite = lightingPlanSpotPoint("kamite");
    const shimote = lightingPlanSpotPoint("shimote");
    expect(center).toEqual({ xPct: 50, yPct: 50 });
    expect(kamite.xPct).toBeGreaterThan(70);
    expect(shimote.xPct).toBeLessThan(30);

    let project = placeLightingPlanCircle(start, "c1", center);
    project = setLightingPlanCircleNumber(project, "c1", "d1", "１２a");
    project = toggleLightingPlanEdge(project, "c1", "kamite");
    project = toggleLightingPlanEdge(project, "c1", "kamite");
    project = toggleLightingPlanEdge(project, "c1", "front");
    project = moveLightingPlanCircle(project, "c1", "d1", 140, -8);
    project = setLightingPlanCueTime(project, "c1", 2, 8);

    expect(project.formations).toBe(start.formations);
    expect(project.cues).toBe(start.cues);
    expect(dancer && project.formations[0]?.dancers[0]).toBe(dancer);
    expect(project.lightingPlan?.drawings?.c1).toEqual([
      { id: "d1", kind: "circle", xPct: 100, yPct: 0, number: "12" },
      { id: "d2", kind: "edge", edge: "front" },
    ]);
    expect(project.lightingPlan?.cueTimes?.c1).toEqual({ tStartSec: 2, tEndSec: 8 });

    const normalized = normalizeProject({
      ...project,
      lightingPlan: {
        ...project.lightingPlan,
        drawings: {
          c1: [
            { id: "d1", kind: "circle", xPct: 100, yPct: 0, number: "12" },
            { id: "d1", kind: "circle", xPct: 10, yPct: 10, number: "9" },
            { id: "bad", kind: "edge", edge: "nope" },
            { id: "e1", kind: "edge", edge: "back" },
            { id: "e2", kind: "edge", edge: "back" },
          ],
          "  ": [{ id: "x", kind: "circle", xPct: 1, yPct: 1 }],
        },
      },
    });
    expect(normalized.lightingPlan?.drawings).toEqual({
      c1: [
        { id: "d1", kind: "circle", xPct: 100, yPct: 0, number: "12" },
        { id: "e1", kind: "edge", edge: "back" },
      ],
    });
    expect(normalized.cues[0]).toMatchObject({ tStartSec: 0, tEndSec: 9 });

    const removed = deleteLightingPlanMark(normalized, "c1", "e1");
    expect(removed.lightingPlan?.drawings?.c1).toEqual([
      { id: "d1", kind: "circle", xPct: 100, yPct: 0, number: "12" },
    ]);
    const cleared = deleteLightingPlanMark(removed, "c1", "d1");
    expect(cleared.lightingPlan?.drawings).toBeUndefined();
  });

  it("hits 上手 on the right edge and a circle at ヘソ", () => {
    const box = { x: 0, y: 0, w: 140, h: 96 };
    const plot = formationSketchPlot(box);
    expect(plot).not.toBeNull();
    if (!plot) return;
    expect(lightingPlanEdgeAt(box, plot.x + plot.w - 1, plot.y + plot.h / 2)).toBe("kamite");
    expect(lightingPlanEdgeAt(box, plot.x + 1, plot.y + plot.h / 2)).toBe("shimote");
    expect(lightingPlanEdgeAt(box, plot.x + plot.w / 2, plot.y + 1)).toBe("back");
    expect(lightingPlanEdgeAt(box, plot.x + plot.w / 2, plot.y + plot.h - 1)).toBe("front");
    const center = lightingPlanSpotPoint("center");
    const hit = hitLightingPlanMark(
      box,
      [{ id: "d1", kind: "circle", xPct: center.xPct, yPct: center.yPct }],
      plot.x + plot.w / 2,
      plot.y + plot.h / 2
    );
    expect(hit).toMatchObject({ id: "d1", kind: "circle" });
  });
});

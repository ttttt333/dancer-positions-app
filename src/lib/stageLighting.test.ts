import { describe, expect, it } from "vitest";
import {
  activeStageLightsAtTime,
  appendBasicStageLights,
  createBasicStageLights,
  createDefaultStageLight,
  normalizeDepthMmList,
  resolveLightAxes,
  yPctFromFrontMm,
} from "./stageLighting";
import {
  buildFrontGridMarks,
  buildSleeveCurtainMarks,
} from "./stageArchitectureGuides";

describe("stageLighting / architecture guides", () => {
  it("maps front distance to yPct (front = 100)", () => {
    expect(yPctFromFrontMm(0, 10000)).toBe(100);
    expect(yPctFromFrontMm(5000, 10000)).toBe(50);
    expect(yPctFromFrontMm(10000, 10000)).toBe(0);
  });

  it("normalizes depth lists", () => {
    expect(normalizeDepthMmList([2000, 2000, 4000, -1])).toEqual([2000, 4000]);
  });

  it("builds front and sleeve marks", () => {
    expect(buildFrontGridMarks([2000, 4000], 10000).map((m) => m.yPct)).toEqual([
      80, 60,
    ]);
    expect(buildSleeveCurtainMarks([2000], 8000)[0]?.kind).toBe("sleeve");
  });

  it("filters lights by time window", () => {
    const a = {
      ...createDefaultStageLight("sideSpot"),
      id: "a",
      tStartSec: 10,
      tEndSec: 20,
    };
    const b = {
      ...createDefaultStageLight("footlight"),
      id: "b",
      tStartSec: null,
      tEndSec: null,
    };
    expect(activeStageLightsAtTime([a, b], 5).map((L) => L.id)).toEqual(["b"]);
    expect(activeStageLightsAtTime([a, b], 15).map((L) => L.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("filters cue-scoped lights by cue window and focus", () => {
    const cues = [
      { id: "c1", tStartSec: 0, tEndSec: 10 },
      { id: "c2", tStartSec: 10, tEndSec: 20 },
    ];
    const cueLight = {
      ...createDefaultStageLight("pinSpot"),
      id: "cueL",
      cueId: "c1",
    };
    const cue2 = {
      ...createDefaultStageLight("pinSpot"),
      id: "cue2L",
      cueId: "c2",
    };
    const global = {
      ...createDefaultStageLight("backlight"),
      id: "g",
      cueId: null,
    };
    expect(
      activeStageLightsAtTime([cueLight, cue2, global], 5, { cues }).map(
        (L) => L.id
      )
    ).toEqual(["cueL", "g"]);
    expect(
      activeStageLightsAtTime([cueLight, cue2, global], 15, { cues }).map(
        (L) => L.id
      )
    ).toEqual(["cue2L", "g"]);
    // フォーカス中は選択キューの灯＋全体のみ（他キューは時間内でも出さない）
    expect(
      activeStageLightsAtTime([cueLight, cue2, global], 5, {
        cues,
        focusCueId: "c2",
      }).map((L) => L.id)
    ).toEqual(["cue2L", "g"]);
  });

  it("resolveLightAxes supports circle aspect correction", () => {
    const L = {
      ...createDefaultStageLight("pinSpot"),
      shape: "circle" as const,
      rxPct: 10,
    };
    const round = resolveLightAxes(L, 1);
    expect(round.rx).toBe(10);
    expect(round.ry).toBe(10);
    const wide = resolveLightAxes(L, 2);
    expect(wide.ry).toBe(20);
  });

  it("createBasicStageLights places white presets for a cue", () => {
    const lights = createBasicStageLights("cue-a");
    expect(lights).toHaveLength(15);
    expect(lights.every((L) => L.color === "#ffffff")).toBe(true);
    expect(lights.every((L) => L.cueId === "cue-a")).toBe(true);
    expect(lights.filter((L) => L.kind === "sideSpot")).toHaveLength(6);
    expect(lights.filter((L) => L.kind === "suspension")).toHaveLength(2);
    expect(lights.filter((L) => L.kind === "pinSpot")).toHaveLength(1);
    expect(lights.filter((L) => L.kind === "footlight")).toHaveLength(3);
    expect(lights.filter((L) => L.kind === "backlight")).toHaveLength(3);
    const pin = lights.find((L) => L.kind === "pinSpot")!;
    expect(pin.xPct).toBe(50);
    expect(pin.yPct).toBe(50);
  });

  it("appendBasicStageLights respects STAGE_LIGHTS_MAX room", () => {
    const next = appendBasicStageLights([], "c1");
    expect(next).toHaveLength(15);
  });
});

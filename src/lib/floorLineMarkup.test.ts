import { describe, expect, it } from "vitest";
import type { StageFloorMarkup } from "../types/choreography";
import {
  FLOOR_LINE_SCOPE_OPTIONS,
  buildFloorLineMarkupFromPoints,
  isFloorLineInGlobalMarkup,
  mergeFloorLineMarkupsForDisplay,
} from "./floorLineMarkup";

describe("floorLineMarkup", () => {
  it("exposes cue-only and all-cues scope options", () => {
    expect(FLOOR_LINE_SCOPE_OPTIONS.map((o) => o.value)).toEqual([
      "formation",
      "global",
    ]);
  });

  it("builds a line from points and rejects short strokes", () => {
    const short = buildFloorLineMarkupFromPoints([
      [10, 10],
      [10.1, 10.1],
    ]);
    expect(short).toBeNull();

    const line = buildFloorLineMarkupFromPoints(
      [
        [10, 10],
        [40, 20],
        [70, 15],
      ],
      { color: "#f87171", widthPx: 5, id: "line-1" }
    );
    expect(line).not.toBeNull();
    expect(line!.kind).toBe("line");
    expect(line!.id).toBe("line-1");
    expect(line!.color).toBe("#f87171");
    expect(line!.widthPx).toBe(5);
    expect(line!.pointsPct).toHaveLength(3);
  });

  it("merges global then cue lines for display", () => {
    const cue: StageFloorMarkup[] = [
      {
        kind: "line",
        id: "cue-a",
        pointsPct: [
          [0, 0],
          [10, 10],
        ],
      },
      {
        kind: "text",
        id: "t1",
        xPct: 50,
        yPct: 50,
        text: "memo",
      },
    ];
    const global: StageFloorMarkup[] = [
      {
        kind: "line",
        id: "g-a",
        pointsPct: [
          [20, 20],
          [30, 30],
        ],
      },
      {
        kind: "line",
        id: "g-short",
        pointsPct: [[1, 1]],
      },
    ];
    const merged = mergeFloorLineMarkupsForDisplay(cue, global);
    expect(merged.map((m) => m.id)).toEqual(["g-a", "cue-a"]);
  });

  it("detects whether a line id lives in global markup", () => {
    const global: StageFloorMarkup[] = [
      {
        kind: "line",
        id: "g1",
        pointsPct: [
          [0, 0],
          [1, 1],
        ],
      },
      {
        kind: "text",
        id: "t1",
        xPct: 1,
        yPct: 1,
        text: "x",
      },
    ];
    expect(isFloorLineInGlobalMarkup("g1", global)).toBe(true);
    expect(isFloorLineInGlobalMarkup("t1", global)).toBe(false);
    expect(isFloorLineInGlobalMarkup("missing", global)).toBe(false);
    expect(isFloorLineInGlobalMarkup("g1", null)).toBe(false);
  });
});

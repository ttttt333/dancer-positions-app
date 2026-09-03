import { describe, expect, it } from "vitest";
import type { ParsedPosition } from "../parsePositionTypes";
import {
  alignPreviewRowY,
  distributePreviewRowX,
  flipPreviewPositions,
  mergePreviewNames,
  nudgePreviewPositions,
  renamePreviewPerson,
  scalePreviewPositions,
} from "./previewAdjust";

function p(
  name: string,
  x: number,
  y: number,
  lineIndex?: number
): ParsedPosition {
  return { name, x, y, lineIndex };
}

describe("scalePreviewPositions", () => {
  it("scales around the group centroid", () => {
    const next = scalePreviewPositions(
      [p("a", 40, 50), p("b", 60, 50)],
      2
    );
    expect(next[0]?.x).toBe(30);
    expect(next[1]?.x).toBe(70);
    expect(next[0]?.y).toBe(50);
  });
});

describe("nudgePreviewPositions", () => {
  it("moves everyone by the same delta", () => {
    const next = nudgePreviewPositions([p("a", 40, 50)], 5, -4);
    expect(next[0]).toMatchObject({ x: 45, y: 46 });
  });
});

describe("flipPreviewPositions", () => {
  it("mirrors left-right around the centroid", () => {
    const next = flipPreviewPositions(
      [p("l", 30, 40), p("r", 70, 40)],
      "x"
    );
    expect(next[0]?.x).toBe(70);
    expect(next[1]?.x).toBe(30);
  });
});

describe("alignPreviewRowY", () => {
  it("averages Y within a row", () => {
    const next = alignPreviewRowY([
      p("a", 30, 40, 0),
      p("b", 50, 46, 0),
      p("c", 40, 80, 1),
    ]);
    expect(next[0]?.y).toBe(43);
    expect(next[1]?.y).toBe(43);
    expect(next[2]?.y).toBe(80);
  });
});

describe("distributePreviewRowX", () => {
  it("evenly spaces a row between the outer two", () => {
    const next = distributePreviewRowX([
      p("a", 10, 50, 0),
      p("b", 18, 50, 0),
      p("c", 90, 50, 0),
    ]);
    expect(next[0]?.x).toBe(10);
    expect(next[1]?.x).toBe(50);
    expect(next[2]?.x).toBe(90);
  });
});

describe("renamePreviewPerson", () => {
  it("changes only the target name", () => {
    const next = renamePreviewPerson(
      [p("かえで", 50, 20), p("そら", 50, 40)],
      1,
      "せら"
    );
    expect(next.map((x) => x.name)).toEqual(["かえで", "せら"]);
  });
});

describe("mergePreviewNames", () => {
  it("keeps edited names when swapping layout presets", () => {
    const named = [p("せら", 10, 10), p("まう", 20, 20)];
    const coords = [p("そら", 40, 40, 1), p("るな", 60, 40, 1)];
    expect(mergePreviewNames(named, coords).map((x) => x.name)).toEqual([
      "せら",
      "まう",
    ]);
    expect(mergePreviewNames(named, coords)[0]?.x).toBe(40);
  });
});

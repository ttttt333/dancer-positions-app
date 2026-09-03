import { describe, expect, it } from "vitest";
import { isFormationImportEngineEnabled } from "./featureFlag";
import { formationBoundingBox } from "./geometry";
import { reconstructFormation } from "./reconstruct";
import { detectRows } from "./rowColumn";
import { staggeredXsForRow, stepForMaxRowCount } from "./mapping";
import type { PersonDetection } from "./types";

function person(
  id: string,
  name: string,
  x: number,
  y: number
): PersonDetection {
  return { id, recognizedName: name, marker: { x, y } };
}

/** 手前から 3-4-3-1（画像上＝奥の 1-3-4-3） */
function handwritten3431(): PersonDetection[] {
  return [
    person("a", "かえで", 200, 40),
    person("b", "りゅうた", 140, 110),
    person("c", "そら", 200, 112),
    person("d", "るな", 260, 111),
    person("e", "くるみ", 110, 180),
    person("f", "よしの", 170, 182),
    person("g", "みゆ", 230, 181),
    person("h", "りせ", 290, 183),
    person("i", "あおい", 140, 250),
    person("j", "たけし", 200, 252),
    person("k", "りこ", 260, 251),
  ];
}

describe("isFormationImportEngineEnabled", () => {
  it("is on by default", () => {
    expect(isFormationImportEngineEnabled()).toBe(true);
  });
});

describe("formationBoundingBox", () => {
  it("uses dancer markers only, not the full image", () => {
    const box = formationBoundingBox(handwritten3431().map((p) => p.marker));
    expect(box.minX).toBe(110);
    expect(box.maxX).toBe(290);
    expect(box.minY).toBe(40);
    expect(box.maxY).toBe(252);
    expect(box.maxX - box.minX).toBeLessThan(400);
  });
});

describe("detectRows", () => {
  it("restores 1-3-4-3 rows from marker Y, not a name grid", () => {
    const rows = detectRows(handwritten3431());
    expect(rows.map((r) => r.members.length)).toEqual([1, 3, 4, 3]);
    expect(rows[0]!.members.map((m) => m.recognizedName)).toEqual(["かえで"]);
    expect(rows[3]!.members.map((m) => m.recognizedName)).toEqual([
      "あおい",
      "たけし",
      "りこ",
    ]);
  });

  it("uses written row counts when they match the dancer total", () => {
    const rows = detectRows(handwritten3431(), [1, 3, 4, 3]);
    expect(rows.map((r) => r.members.length)).toEqual([1, 3, 4, 3]);
  });
});

describe("staggeredXsForRow", () => {
  it("puts a 4-person row in the gaps of a 3-person row", () => {
    const step = stepForMaxRowCount(4);
    const three = staggeredXsForRow(3, step);
    const four = staggeredXsForRow(4, step);
    expect(four[1]).toBeCloseTo((three[0]! + three[1]!) / 2);
    expect(four[2]).toBeCloseTo((three[1]! + three[2]!) / 2);
    expect(four[0]).toBeLessThan(three[0]!);
    expect(four[3]).toBeGreaterThan(three[2]!);
  });
});

describe("reconstructFormation", () => {
  it("keeps relative spacing instead of even-column snapping", () => {
    const result = reconstructFormation(
      [
        person("l", "左", 10, 50),
        person("c", "中", 18, 50),
        person("r", "右", 90, 50),
      ],
      { imageWidth: 1000, imageHeight: 1000, placement: "raw" }
    );
    const xs = result.dancers.map((d) => d.stagePosition.x);
    const spanLeft = xs[1]! - xs[0]!;
    const spanRight = xs[2]! - xs[1]!;
    expect(spanRight).toBeGreaterThan(spanLeft * 2);
    expect(result.mapping.formationBox.minX).toBe(10);
    expect(result.mapping.formationBox.maxX).toBe(90);
  });

  it("does not map lookalike roster names onto the wrong people", () => {
    const result = reconstructFormation(handwritten3431(), {
      roster: [
        "かんな",
        "たいち",
        "ありす",
        "かえで",
        "りゅうた",
        "そら",
        "るな",
        "くるみ",
        "よしの",
        "みゆ",
        "りせ",
        "あおい",
        "たけし",
        "りこ",
      ],
      rosterCount: 11,
      imageWidth: 400,
      imageHeight: 400,
    });
    const names = result.dancers.map((d) => d.recognizedName);
    expect(names).toContain("かえで");
    expect(names).not.toContain("かんな");
    expect(names).not.toContain("たいち");
    expect(result.formation.rows.map((r) => r.dancerIds.length)).toEqual([
      1, 3, 4, 3,
    ]);
    expect(result.warnings.some((w) => w.kind === "count_extra")).toBe(false);
  });

  it("warns when a name appears twice and does not drop either", () => {
    const result = reconstructFormation(
      [
        person("a", "りせ", 10, 10),
        person("b", "りせ", 40, 10),
      ],
      { roster: ["りせ", "るな"] }
    );
    expect(result.dancers).toHaveLength(2);
    expect(result.dancers.filter((d) => d.recognizedName === "りせ")).toHaveLength(
      1
    );
    expect(result.dancers.some((d) => d.recognizedName === "")).toBe(true);
    expect(result.dancers.map((d) => d.recognizedName)).not.toContain("るな");
  });

  it("never keeps OCR names that are not on the roster", () => {
    const result = reconstructFormation(
      [
        person("a", "花香", 10, 10),
        person("b", "ほなか", 40, 10),
        person("c", "はなか", 70, 10),
      ],
      { roster: ["はなか", "さくら"] }
    );
    const names = result.dancers.map((d) => d.recognizedName);
    expect(names).toEqual(["", "", "はなか"]);
    expect(names.every((n) => n === "" || n === "はなか" || n === "さくら")).toBe(
      true
    );
  });

  it("keeps raw and suggested stage positions as separate values", () => {
    const result = reconstructFormation(handwritten3431(), {
      placement: "raw",
      imageWidth: 400,
      imageHeight: 320,
    });
    const front = result.dancers.filter((d) => d.structuralRole?.row === 3);
    const rawYs = new Set(front.map((d) => d.rawStagePosition.y));
    const sugYs = new Set(front.map((d) => d.suggestedStagePosition.y));
    expect(rawYs.size).toBeGreaterThan(1);
    expect(sugYs.size).toBe(1);
    expect(result.dancers[0]?.stagePosition).toEqual(
      result.dancers[0]?.rawStagePosition
    );
  });

  it("staggers the 4-person row into the gaps of the 3-person row", () => {
    const result = reconstructFormation(handwritten3431(), {
      placement: "suggested",
      rowCounts: [1, 3, 4, 3],
      imageWidth: 400,
      imageHeight: 320,
    });
    const xOf = (name: string) =>
      result.dancers.find((d) => d.recognizedName === name)?.suggestedStagePosition.x;
    expect(xOf("みゆ")).not.toBeCloseTo(xOf("そら") ?? 0, 0);
    expect(xOf("よしの")).toBeGreaterThan(xOf("りゅうた") ?? 0);
    expect(xOf("よしの")).toBeLessThan(xOf("そら") ?? 0);
    expect(xOf("みゆ")).toBeGreaterThan(xOf("そら") ?? 0);
    expect(xOf("みゆ")).toBeLessThan(xOf("るな") ?? 0);
    expect(xOf("かえで")).toBeCloseTo(xOf("そら") ?? 0);
    expect(xOf("たけし")).toBeCloseTo(xOf("そら") ?? 0);
  });
});

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createDefaultFormationTemplates } from "./FormationTemplates";
import { defaultFormationTemplateRegistry } from "./FormationTemplateRegistry";
import { gridDims, pyramidRows } from "./geometry";

describe("FormationTemplates", () => {
  it("registers the required formation types", () => {
    const types = new Set(createDefaultFormationTemplates().map((t) => t.type));
    for (const type of [
      "CENTER",
      "LINE",
      "DOUBLE_LINE",
      "V",
      "WIDE_V",
      "DIAGONAL",
      "DOUBLE_DIAGONAL",
      "TRIANGLE",
      "DIAMOND",
      "GRID",
      "ARC",
      "CLUSTER",
      "CENTER_WINGS",
      "SPLIT",
      "PYRAMID",
      "ARROW",
    ]) {
      expect(types.has(type as never)).toBe(true);
    }
  });

  it("each template generates the requested count", () => {
    const templates = defaultFormationTemplateRegistry.getTemplatesForDancerCount(8);
    for (const t of templates) {
      const slots = t.generator(8, { spread: 0.8 });
      expect(slots).toHaveLength(8);
    }
  });

  it("grid and pyramid helpers match expected shapes", () => {
    expect(gridDims(9)).toEqual({ cols: 3, rows: 3 });
    expect(gridDims(12)).toEqual({ cols: 4, rows: 3 });
    expect(pyramidRows(9).reduce((s, n) => s + n, 0)).toBe(9);
  });
});

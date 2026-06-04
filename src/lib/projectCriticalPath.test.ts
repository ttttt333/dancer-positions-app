import { describe, expect, it, beforeEach } from "vitest";
import { normalizeProject } from "./normalizeProject";
import { saveProject, loadProject, clearProject } from "./projectStorage";
import { createEmptyProject } from "./projectDefaults";

describe("project critical path", () => {
  beforeEach(() => {
    clearProject();
  });

  it("createEmptyProject has version 3 and one formation", () => {
    const p = createEmptyProject();
    expect(p.version).toBe(3);
    expect(p.formations).toHaveLength(1);
    expect(p.cues).toEqual([]);
  });

  it("saveProject and loadProject round-trip via localStorage", () => {
    const p = createEmptyProject();
    p.pieceTitle = "Test Piece";
    saveProject(p);
    const loaded = loadProject();
    expect(loaded?.pieceTitle).toBe("Test Piece");
    expect(loaded?.version).toBe(3);
  });

  it("normalizeProject accepts minimal legacy-ish payload", () => {
    const raw = {
      version: 2,
      pieceTitle: "Legacy",
      formations: [{ id: "f1", name: "F1", dancers: [], setPieces: [] }],
      cues: [],
    };
    const normalized = normalizeProject(raw);
    expect(normalized.pieceTitle).toBe("Legacy");
    expect(normalized.formations.length).toBeGreaterThanOrEqual(1);
  });

  it("normalizeProject preserves dancer nameBelowFontPx", () => {
    const raw = {
      version: 3,
      pieceTitle: "Font",
      formations: [
        {
          id: "f1",
          name: "F1",
          dancers: [
            {
              id: "d1",
              label: "1",
              xPct: 50,
              yPct: 50,
              colorIndex: 0,
              nameBelowFontPx: 22,
            },
          ],
          setPieces: [],
        },
      ],
      cues: [],
    };
    const normalized = normalizeProject(raw);
    expect(normalized.formations[0]?.dancers[0]?.nameBelowFontPx).toBe(22);
  });
});

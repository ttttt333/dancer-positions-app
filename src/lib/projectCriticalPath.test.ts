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

  it("normalizeProject keeps a saved heso position", () => {
    const raw = {
      version: 3,
      pieceTitle: "Heso",
      stageHesoVisible: true,
      stageCenterMarks: [
        {
          id: "heso-1",
          xPct: 37.5,
          yPct: 62,
          label: "ヘソ",
          rxPct: 3,
          shape: "circle",
        },
      ],
      formations: [{ id: "f1", name: "F1", dancers: [], setPieces: [] }],
      cues: [],
    };
    const normalized = normalizeProject(raw);
    expect(normalized.stageHesoVisible).toBe(true);
    expect(normalized.stageCenterMarks).toHaveLength(1);
    expect(normalized.stageCenterMarks?.[0]).toMatchObject({
      id: "heso-1",
      xPct: 37.5,
      yPct: 62,
      label: "ヘソ",
    });
    const again = normalizeProject(JSON.parse(JSON.stringify(normalized)));
    expect(again.stageCenterMarks?.[0]?.xPct).toBe(37.5);
    expect(again.stageCenterMarks?.[0]?.yPct).toBe(62);
    expect(again.stageHesoVisible).toBe(true);
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

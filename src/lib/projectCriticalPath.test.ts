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
});

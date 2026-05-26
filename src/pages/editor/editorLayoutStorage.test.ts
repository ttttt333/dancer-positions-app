import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clampTopDockRowPx,
  persistEditorLayout,
  readStoredEditorLayout,
} from "./editorLayoutStorage";
import {
  EDITOR_LAYOUT_LEGACY_STORAGE_KEY,
  EDITOR_LAYOUT_STORAGE_KEY,
  TOP_DOCK_ROW_MAX_PX,
  TOP_DOCK_ROW_MIN_PX,
} from "./editorConstants";

describe("editorLayoutStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clampTopDockRowPx enforces min/max", () => {
    expect(clampTopDockRowPx(10)).toBe(TOP_DOCK_ROW_MIN_PX);
    expect(clampTopDockRowPx(9999)).toBe(TOP_DOCK_ROW_MAX_PX);
    expect(clampTopDockRowPx(120.6)).toBe(121);
  });

  it("readStoredEditorLayout returns nulls when empty", () => {
    expect(readStoredEditorLayout()).toEqual({
      stageColumnPx: null,
      topDockRowPx: null,
    });
  });

  it("persistEditorLayout writes and readStoredEditorLayout reads back", () => {
    persistEditorLayout({ stageColumnPx: 640, topDockRowPx: 180 });
    expect(readStoredEditorLayout()).toEqual({
      stageColumnPx: 640,
      topDockRowPx: 180,
    });
  });

  it("migrates legacy storage key to v2", () => {
    localStorage.setItem(
      EDITOR_LAYOUT_LEGACY_STORAGE_KEY,
      JSON.stringify({ stageColumnPx: 500, topDockRowPx: 100 })
    );
    const layout = readStoredEditorLayout();
    expect(layout.stageColumnPx).toBe(500);
    expect(localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY)).toBeTruthy();
  });
});

import { safeGetItem, safeSetItem } from "../../utils/storage";
import {
  EDITOR_LAYOUT_LEGACY_STORAGE_KEY,
  EDITOR_LAYOUT_STORAGE_KEY,
  STAGE_COL_MIN_PX,
  TOP_DOCK_ROW_MAX_PX,
  TOP_DOCK_ROW_MIN_PX,
} from "./editorConstants";

export type StoredEditorLayout = {
  stageColumnPx: number | null;
  topDockRowPx: number | null;
};

export function clampTopDockRowPx(n: number): number {
  return Math.min(
    TOP_DOCK_ROW_MAX_PX,
    Math.max(TOP_DOCK_ROW_MIN_PX, Math.round(n))
  );
}

export function readStoredEditorLayout(): StoredEditorLayout {
  if (typeof window === "undefined") {
    return { stageColumnPx: null, topDockRowPx: null };
  }
  try {
    const parsedCurrent = safeGetItem<Record<string, unknown> | null>(
      EDITOR_LAYOUT_STORAGE_KEY,
      null
    );
    const parsedLegacy = safeGetItem<Record<string, unknown> | null>(
      EDITOR_LAYOUT_LEGACY_STORAGE_KEY,
      null
    );
    const legacyRaw = localStorage.getItem(EDITOR_LAYOUT_LEGACY_STORAGE_KEY);
    const o = parsedCurrent ?? parsedLegacy;
    if (!o || typeof o !== "object") {
      return { stageColumnPx: null, topDockRowPx: null };
    }
    const sc =
      typeof o.stageColumnPx === "number" &&
      Number.isFinite(o.stageColumnPx) &&
      o.stageColumnPx >= STAGE_COL_MIN_PX
        ? o.stageColumnPx
        : null;
    const td =
      typeof o.topDockRowPx === "number" &&
      Number.isFinite(o.topDockRowPx) &&
      o.topDockRowPx >= TOP_DOCK_ROW_MIN_PX &&
      o.topDockRowPx <= TOP_DOCK_ROW_MAX_PX
        ? Math.round(o.topDockRowPx)
        : null;
    if (!parsedCurrent && legacyRaw) {
      try {
        localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, legacyRaw);
      } catch {
        /* 移行失敗は無視 */
      }
    }
    return { stageColumnPx: sc, topDockRowPx: td };
  } catch {
    return { stageColumnPx: null, topDockRowPx: null };
  }
}

export function persistEditorLayout(layout: StoredEditorLayout): void {
  if (typeof window === "undefined") return;
  safeSetItem(EDITOR_LAYOUT_STORAGE_KEY, {
    stageColumnPx: layout.stageColumnPx,
    topDockRowPx:
      layout.topDockRowPx == null
        ? null
        : clampTopDockRowPx(layout.topDockRowPx),
  });
}

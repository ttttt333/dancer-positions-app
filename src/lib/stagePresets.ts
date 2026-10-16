/**
 * ステージ情報プリセット — よく使う舞台寸法（メイン幅・奥行・サイド・バック・
 * センターからの場ミリ）とヘソ／そで幕を名前付きで `localStorage` に保存する。
 *
 * プロジェクト毎に毎回手で入力し直さなくて済むよう、端末横断のグローバル倉庫として扱う。
 */

import type {
  StageCenterMark,
  StageSleeveCurtain,
} from "../types/choreography";
import { normalizeStageCenterMarks } from "./stageCenterMarks";
import { normalizeStageSleeveCurtains } from "./stageSleeveCurtains";

const STORAGE_KEY = "choreogrid_stage_presets_v1";
const MAX_NAME_LEN = 120;

export type StagePresetDimensions = {
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  sideStageMm: number | null;
  backStageMm: number | null;
  centerFieldGuideIntervalMm: number | null;
  /** ヘソ／センターマーク表示。旧プリセットは未定義（呼び出し時に上書きしない） */
  stageHesoVisible?: boolean;
  /** ヘソ位置・サイズ。未定義＝旧プリセット */
  stageCenterMarks?: StageCenterMark[];
  /** そで幕。未定義＝旧プリセット */
  stageSleeveCurtains?: StageSleeveCurtain[];
};

export type StagePresetItem = StagePresetDimensions & {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type StagePresetSaveResult =
  | { ok: true; item: StagePresetItem }
  | { ok: false; reason: "quota" | "unknown"; message: string };

function isFinitePositiveOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
}

function normalizeDim(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isFinite(v)) return null;
  const n = Math.max(0, Math.round(v));
  return n > 0 ? n : null;
}

function normalizeGuideFields(
  dims: Pick<
    StagePresetDimensions,
    "stageHesoVisible" | "stageCenterMarks" | "stageSleeveCurtains"
  >
): Pick<
  StagePresetDimensions,
  "stageHesoVisible" | "stageCenterMarks" | "stageSleeveCurtains"
> {
  const hesoVisible = dims.stageHesoVisible === true;
  const marks = normalizeStageCenterMarks(dims.stageCenterMarks, {
    seedCenterIfEmpty: hesoVisible,
  });
  const curtains = normalizeStageSleeveCurtains(
    dims.stageSleeveCurtains,
    undefined
  );
  return {
    stageHesoVisible: hesoVisible,
    stageCenterMarks: marks,
    stageSleeveCurtains: curtains,
  };
}

/** 保存ペイロードからガイド類を正規化して取り出す（常に書き込む用） */
export function stagePresetGuideSnapshot(dims: {
  stageHesoVisible?: boolean;
  stageCenterMarks?: readonly StageCenterMark[];
  stageSleeveCurtains?: readonly StageSleeveCurtain[];
}): Pick<
  StagePresetDimensions,
  "stageHesoVisible" | "stageCenterMarks" | "stageSleeveCurtains"
> {
  return normalizeGuideFields({
    stageHesoVisible: dims.stageHesoVisible === true,
    stageCenterMarks: dims.stageCenterMarks
      ? [...dims.stageCenterMarks]
      : [],
    stageSleeveCurtains: dims.stageSleeveCurtains
      ? [...dims.stageSleeveCurtains]
      : [],
  });
}

function isValidItem(x: unknown): x is StagePresetItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    isFinitePositiveOrNull(o.stageWidthMm) &&
    isFinitePositiveOrNull(o.stageDepthMm) &&
    isFinitePositiveOrNull(o.sideStageMm) &&
    isFinitePositiveOrNull(o.backStageMm) &&
    isFinitePositiveOrNull(o.centerFieldGuideIntervalMm)
  );
}

function readAll(): StagePresetItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem).map((item) => {
      const base: StagePresetItem = {
        id: item.id,
        name: (item.name || "").slice(0, MAX_NAME_LEN),
        stageWidthMm: normalizeDim(item.stageWidthMm),
        stageDepthMm: normalizeDim(item.stageDepthMm),
        sideStageMm: normalizeDim(item.sideStageMm),
        backStageMm: normalizeDim(item.backStageMm),
        centerFieldGuideIntervalMm: normalizeDim(
          item.centerFieldGuideIntervalMm
        ),
        createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
        updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
      };
      // 新フィールドがあるときだけ載せる（旧プリセットは未定義のまま）
      const hasGuide =
        item.stageHesoVisible !== undefined ||
        item.stageCenterMarks !== undefined ||
        item.stageSleeveCurtains !== undefined;
      if (!hasGuide) return base;
      return {
        ...base,
        ...normalizeGuideFields({
          stageHesoVisible: item.stageHesoVisible === true,
          stageCenterMarks: Array.isArray(item.stageCenterMarks)
            ? item.stageCenterMarks
            : [],
          stageSleeveCurtains: Array.isArray(item.stageSleeveCurtains)
            ? item.stageSleeveCurtains
            : [],
        }),
      };
    });
  } catch {
    return [];
  }
}

class StagePresetQuotaError extends Error {
  constructor() {
    super(
      "保存容量がいっぱいのため、新しいステージ情報を保存できませんでした。古いものをいくつか削除して、もう一度お試しください。"
    );
    this.name = "StagePresetQuotaError";
  }
}

function writeAll(items: StagePresetItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    if (
      typeof DOMException !== "undefined" &&
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new StagePresetQuotaError();
    }
    throw new StagePresetQuotaError();
  }
}

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 新しい順で返す */
export function listStagePresets(): StagePresetItem[] {
  const list = readAll();
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 寸法もガイドも無いなら保存しない */
function isAllEmpty(dims: StagePresetDimensions): boolean {
  const noDims =
    dims.stageWidthMm == null &&
    dims.stageDepthMm == null &&
    dims.sideStageMm == null &&
    dims.backStageMm == null &&
    dims.centerFieldGuideIntervalMm == null;
  if (!noDims) return false;
  const guides = stagePresetGuideSnapshot(dims);
  return (
    !guides.stageHesoVisible &&
    (guides.stageCenterMarks?.length ?? 0) === 0 &&
    (guides.stageSleeveCurtains?.length ?? 0) === 0
  );
}

export function saveStagePreset(
  name: string,
  dims: StagePresetDimensions
): StagePresetSaveResult {
  const n = (name || "").trim().slice(0, MAX_NAME_LEN) || `ステージ`;
  if (isAllEmpty(dims)) {
    return {
      ok: false,
      reason: "unknown",
      message: "保存する寸法・ヘソ・そで幕が何も入っていません。",
    };
  }
  const now = Date.now();
  const guides = stagePresetGuideSnapshot(dims);
  const item: StagePresetItem = {
    id: genId(),
    name: n,
    stageWidthMm: normalizeDim(dims.stageWidthMm),
    stageDepthMm: normalizeDim(dims.stageDepthMm),
    sideStageMm: normalizeDim(dims.sideStageMm),
    backStageMm: normalizeDim(dims.backStageMm),
    centerFieldGuideIntervalMm: normalizeDim(dims.centerFieldGuideIntervalMm),
    ...guides,
    createdAt: now,
    updatedAt: now,
  };
  const cur = readAll();
  cur.unshift(item);
  try {
    writeAll(cur);
    return { ok: true, item };
  } catch (e) {
    if (e instanceof StagePresetQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "保存中に想定外のエラーが発生しました。",
    };
  }
}

export function updateStagePreset(
  id: string,
  dims: StagePresetDimensions
): StagePresetSaveResult {
  const list = readAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return {
      ok: false,
      reason: "unknown",
      message: "対象のステージ情報が見つかりません。",
    };
  }
  const existing = list[idx]!;
  const guides = stagePresetGuideSnapshot(dims);
  const updated: StagePresetItem = {
    ...existing,
    stageWidthMm: normalizeDim(dims.stageWidthMm),
    stageDepthMm: normalizeDim(dims.stageDepthMm),
    sideStageMm: normalizeDim(dims.sideStageMm),
    backStageMm: normalizeDim(dims.backStageMm),
    centerFieldGuideIntervalMm: normalizeDim(dims.centerFieldGuideIntervalMm),
    ...guides,
    updatedAt: Date.now(),
  };
  list[idx] = updated;
  try {
    writeAll(list);
    return { ok: true, item: updated };
  } catch (e) {
    if (e instanceof StagePresetQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "保存中に想定外のエラーが発生しました。",
    };
  }
}

export function renameStagePreset(id: string, name: string): boolean {
  const list = readAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!n) return false;
  list[idx] = { ...list[idx]!, name: n, updatedAt: Date.now() };
  try {
    writeAll(list);
    return true;
  } catch {
    return false;
  }
}

export function deleteStagePreset(id: string): void {
  const list = readAll().filter((x) => x.id !== id);
  try {
    writeAll(list);
  } catch {
    /* quota は削除なら起きない想定 */
  }
}

/** プリセットにガイド類が含まれているか（旧データは false） */
export function stagePresetHasGuideFields(item: StagePresetItem): boolean {
  return (
    item.stageHesoVisible !== undefined ||
    item.stageCenterMarks !== undefined ||
    item.stageSleeveCurtains !== undefined
  );
}

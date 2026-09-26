/**
 * 照明プリセット — キューに紐づかない見た目一式を名前付きで localStorage に保存。
 * どの作品・どのキューからも呼び出して適用できる。
 */

import type { StageLightFixture, StageLightKind } from "../types/choreography";
import {
  STAGE_LIGHT_KIND_LABELS,
  STAGE_LIGHT_KINDS,
  STAGE_LIGHTS_MAX,
} from "./stageLighting";

export const LIGHTING_PRESETS_STORAGE_KEY = "choreogrid_lighting_presets_v1";

const MAX_NAME_LEN = 120;
const MAX_PRESETS = 40;

/** プリセットに保存する照明（id / cue / 時間は持たない） */
export type LightingPresetFixture = {
  kind: StageLightKind;
  label?: string;
  xPct: number;
  yPct: number;
  color: string;
  intensity: number;
  rxPct?: number;
  ryPct?: number;
  shape?: "circle" | "ellipse";
  enabled?: boolean;
};

export type LightingPresetItem = {
  id: string;
  name: string;
  lights: LightingPresetFixture[];
  createdAt: number;
  updatedAt: number;
};

export type LightingPresetSaveResult =
  | { ok: true; item: LightingPresetItem }
  | { ok: false; reason: "quota" | "empty" | "unknown"; message: string };

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampAxis(v: number): number {
  return Math.max(2, Math.min(60, v));
}

function isKind(k: unknown): k is StageLightKind {
  return (
    typeof k === "string" &&
    (STAGE_LIGHT_KINDS as readonly string[]).includes(k)
  );
}

export function toLightingPresetFixture(
  L: StageLightFixture
): LightingPresetFixture {
  return {
    kind: L.kind,
    ...(L.label ? { label: L.label.slice(0, 40) } : {}),
    xPct: clampPct(L.xPct),
    yPct: clampPct(L.yPct),
    color: /^#[0-9a-fA-F]{6}$/.test(L.color) ? L.color.toLowerCase() : "#ffffff",
    intensity: clamp01(L.intensity),
    ...(typeof L.rxPct === "number" && Number.isFinite(L.rxPct)
      ? { rxPct: clampAxis(L.rxPct) }
      : {}),
    ...(typeof L.ryPct === "number" && Number.isFinite(L.ryPct)
      ? { ryPct: clampAxis(L.ryPct) }
      : {}),
    ...(L.shape === "circle" || L.shape === "ellipse"
      ? { shape: L.shape }
      : {}),
    enabled: L.enabled === false ? false : true,
  };
}

function normalizeFixture(raw: unknown): LightingPresetFixture | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isKind(o.kind)) return null;
  const xPct =
    typeof o.xPct === "number" && Number.isFinite(o.xPct)
      ? clampPct(o.xPct)
      : 50;
  const yPct =
    typeof o.yPct === "number" && Number.isFinite(o.yPct)
      ? clampPct(o.yPct)
      : 50;
  const color =
    typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color)
      ? o.color.toLowerCase()
      : "#ffffff";
  const intensity =
    typeof o.intensity === "number" && Number.isFinite(o.intensity)
      ? clamp01(o.intensity)
      : 0.4;
  const rxPct =
    typeof o.rxPct === "number" && Number.isFinite(o.rxPct)
      ? clampAxis(o.rxPct)
      : undefined;
  const ryPct =
    typeof o.ryPct === "number" && Number.isFinite(o.ryPct)
      ? clampAxis(o.ryPct)
      : undefined;
  const shape = o.shape === "circle" ? "circle" : "ellipse";
  return {
    kind: o.kind,
    ...(typeof o.label === "string" && o.label.trim()
      ? { label: o.label.trim().slice(0, 40) }
      : {}),
    xPct,
    yPct,
    color,
    intensity,
    ...(rxPct != null ? { rxPct } : {}),
    ...(ryPct != null ? { ryPct } : {}),
    shape,
    enabled: o.enabled === false ? false : true,
  };
}

function isValidItem(x: unknown): x is LightingPresetItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.lights) &&
    typeof o.createdAt === "number" &&
    typeof o.updatedAt === "number"
  );
}

function readAll(): LightingPresetItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIGHTING_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidItem)
      .map((item) => ({
        id: item.id,
        name: (item.name || "").slice(0, MAX_NAME_LEN),
        lights: item.lights
          .map(normalizeFixture)
          .filter((x): x is LightingPresetFixture => x != null)
          .slice(0, STAGE_LIGHTS_MAX),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
      .filter((item) => item.lights.length > 0)
      .slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

class LightingPresetQuotaError extends Error {
  constructor() {
    super(
      "保存容量がいっぱいのため、照明プリセットを保存できませんでした。古いものを削除してからもう一度お試しください。"
    );
    this.name = "LightingPresetQuotaError";
  }
}

function writeAll(items: LightingPresetItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      LIGHTING_PRESETS_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_PRESETS))
    );
  } catch (e) {
    if (
      typeof DOMException !== "undefined" &&
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new LightingPresetQuotaError();
    }
    throw new LightingPresetQuotaError();
  }
}

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 新しい順 */
export function listLightingPresets(): LightingPresetItem[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveLightingPreset(
  name: string,
  lights: readonly StageLightFixture[]
): LightingPresetSaveResult {
  const fixtures = lights
    .filter((L) => L.enabled !== false)
    .map(toLightingPresetFixture)
    .slice(0, STAGE_LIGHTS_MAX);
  if (fixtures.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "保存する照明がありません。",
    };
  }
  const n =
    (name || "").trim().slice(0, MAX_NAME_LEN) ||
    `照明 ${fixtures.length}灯`;
  const now = Date.now();
  const item: LightingPresetItem = {
    id: genId(),
    name: n,
    lights: fixtures,
    createdAt: now,
    updatedAt: now,
  };
  const cur = readAll();
  cur.unshift(item);
  try {
    writeAll(cur);
    return { ok: true, item };
  } catch (e) {
    if (e instanceof LightingPresetQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "保存中に想定外のエラーが発生しました。",
    };
  }
}

export function deleteLightingPreset(id: string): boolean {
  const list = readAll();
  const next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return false;
  try {
    writeAll(next);
    return true;
  } catch {
    return false;
  }
}

export function renameLightingPreset(
  id: string,
  name: string
): LightingPresetSaveResult {
  const list = readAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return {
      ok: false,
      reason: "unknown",
      message: "プリセットが見つかりません。",
    };
  }
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!n) {
    return { ok: false, reason: "empty", message: "名前を入力してください。" };
  }
  const updated: LightingPresetItem = {
    ...list[idx]!,
    name: n,
    updatedAt: Date.now(),
  };
  list[idx] = updated;
  try {
    writeAll(list);
    return { ok: true, item: updated };
  } catch (e) {
    if (e instanceof LightingPresetQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "名前の変更に失敗しました。",
    };
  }
}

/** プリセット灯をキュー（または全体）向けの実体に変換 */
export function materializeLightingPreset(
  preset: LightingPresetItem,
  cueId: string | null
): StageLightFixture[] {
  return preset.lights.map((L) => ({
    id: crypto.randomUUID(),
    kind: L.kind,
    label: L.label ?? STAGE_LIGHT_KIND_LABELS[L.kind],
    xPct: L.xPct,
    yPct: L.yPct,
    color: L.color,
    intensity: L.intensity,
    ...(L.rxPct != null ? { rxPct: L.rxPct } : {}),
    ...(L.ryPct != null ? { ryPct: L.ryPct } : {}),
    shape: L.shape ?? "ellipse",
    cueId,
    tStartSec: null,
    tEndSec: null,
    enabled: L.enabled !== false,
  }));
}

/**
 * 対象キューの照明を消してプリセットを適用。
 * cueId が null のときは全体灯だけ置き換える。
 */
export function replaceLightsFromPreset(
  existing: readonly StageLightFixture[],
  cueId: string | null,
  preset: LightingPresetItem
): StageLightFixture[] {
  const without =
    cueId == null
      ? existing.filter((L) => L.cueId)
      : existing.filter((L) => L.cueId !== cueId);
  const room = STAGE_LIGHTS_MAX - without.length;
  if (room <= 0) return without;
  const added = materializeLightingPreset(preset, cueId).slice(0, room);
  return [...without, ...added];
}

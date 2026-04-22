import type {
  AudienceEdge,
  ChoreographyProjectJson,
  Cue,
  DancerSpot,
  Formation,
  StageShape,
} from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";

/**
 * 「フローライブラリ」— 1 曲ぶんの **立ち位置の流れ**（フォーメーション群＋キュー順）を
 * 名前付きで端末ローカルに保存して、別の曲・別のプロジェクトでも呼び出せるようにする。
 *
 * - プロジェクト `savedSpotLayouts`（1 形だけのスナップショット）や、
 *   `形の箱`（個別の立ち位置単位の倉庫）とは別軸の **「曲構成テンプレ」** にあたる。
 * - 保存先は `localStorage`。プロジェクト本体（.json）には載らないので、
 *   保存量は端末の容量次第（5MB 上限）。
 * - 任意で「秒数タイミング」も含められる。違う曲に当てるときはオフが既定。
 * - 保存時点の **ステージ幅・奥行・場ミリ（dancerSpacingMm）・客席向き・変形舞台** なども
 *   `stageSettings` として保持し、呼び出し時にキューとともに復元する（旧データは従来どおり）。
 */

const STORAGE_KEY = "choreogrid_flow_library_v1";
/** 1 フローあたりのキュー上限・形上限（容量と画面の両方を守るための保険） */
const MAX_CUES = 200;
const MAX_FORMATIONS = 200;
const MAX_DANCERS_PER_FORM = 80;
const MAX_NAME_LEN = 120;

/**
 * フロー内の 1 つの「形」。プロジェクト側の `Formation` の最小コピー。
 * - id はフロー内で一意（cues[].formationIdRef が指す）
 * - 立ち位置の生データ（xPct/yPct）と、人物識別ラベルだけを持つ
 */
export interface FlowFormationSnapshot {
  id: string;
  name: string;
  dancers: {
    label: string;
    xPct: number;
    yPct: number;
    colorIndex?: number;
    note?: string;
  }[];
}

/** フローのキュー 1 行ぶん。秒数は `hasTiming === false` なら null。 */
export interface FlowCueSnapshot {
  /** 並び順用のクライアント生成 ID（参照には使わない） */
  id: string;
  name?: string;
  note?: string;
  tStartSec: number | null;
  tEndSec: number | null;
  formationIdRef: string;
}

/**
 * フロー保存時点のステージ寸法・場ミリ・客席向きなど。
 * 呼び出し時に現在プロジェクトより優先して復元する（旧フローに無い場合は復元しない）。
 */
export interface FlowStageSettingsSnapshot {
  audienceEdge: AudienceEdge;
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  sideStageMm: number | null;
  backStageMm: number | null;
  centerFieldGuideIntervalMm: number | null;
  dancerSpacingMm?: number;
  gridSpacingMm?: number;
  stageShape?: StageShape;
  hanamichiEnabled?: boolean;
  hanamichiDepthPct?: number;
  dancerMarkerDiameterMm?: number;
  snapGrid: boolean;
  gridStep: number;
  stageGridLinesEnabled?: boolean;
  stageGridLineSpacingMm?: number;
}

export interface FlowLibraryItem {
  id: string;
  name: string;
  /** タイミング（秒数）も保存しているか */
  hasTiming: boolean;
  /** ダンサー人数（フィルタ表示用、最初の形の人数） */
  dancerCount: number;
  /** キュー数 */
  cueCount: number;
  formations: FlowFormationSnapshot[];
  cues: FlowCueSnapshot[];
  /** 保存時のステージ設定。未保存の旧データは undefined */
  stageSettings?: FlowStageSettingsSnapshot;
  createdAt: number;
  updatedAt: number;
}

/**
 * 形の箱と同じく、同一タブ内で mutation を伝えるためのカスタムイベント。
 */
export const FLOW_LIBRARY_CHANGE_EVENT = "flowLibrary:changed";

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(FLOW_LIBRARY_CHANGE_EVENT));
  } catch {
    /** 一部環境で Event の生成に失敗するが致命ではない */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function snapshotStageFromProject(
  p: ChoreographyProjectJson
): FlowStageSettingsSnapshot {
  return {
    audienceEdge: p.audienceEdge,
    stageWidthMm: p.stageWidthMm,
    stageDepthMm: p.stageDepthMm,
    sideStageMm: p.sideStageMm ?? null,
    backStageMm: p.backStageMm ?? null,
    centerFieldGuideIntervalMm: p.centerFieldGuideIntervalMm ?? null,
    dancerSpacingMm: p.dancerSpacingMm,
    gridSpacingMm: p.gridSpacingMm,
    stageShape: p.stageShape,
    hanamichiEnabled: p.hanamichiEnabled,
    hanamichiDepthPct: p.hanamichiDepthPct,
    dancerMarkerDiameterMm: p.dancerMarkerDiameterMm,
    snapGrid: p.snapGrid,
    gridStep: p.gridStep,
    stageGridLinesEnabled: p.stageGridLinesEnabled,
    stageGridLineSpacingMm: p.stageGridLineSpacingMm,
  };
}

/** localStorage から読んだ `stageSettings` を検証・正規化。不正なら undefined */
function normalizeStageSettings(
  raw: unknown
): FlowStageSettingsSnapshot | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const edge = o.audienceEdge;
  if (edge !== "top" && edge !== "bottom" && edge !== "left" && edge !== "right")
    return undefined;
  const mmOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    audienceEdge: edge,
    stageWidthMm: mmOrNull(o.stageWidthMm),
    stageDepthMm: mmOrNull(o.stageDepthMm),
    sideStageMm: mmOrNull(o.sideStageMm),
    backStageMm: mmOrNull(o.backStageMm),
    centerFieldGuideIntervalMm: mmOrNull(o.centerFieldGuideIntervalMm),
    ...(typeof o.dancerSpacingMm === "number" && Number.isFinite(o.dancerSpacingMm)
      ? { dancerSpacingMm: o.dancerSpacingMm }
      : {}),
    ...(typeof o.gridSpacingMm === "number" && Number.isFinite(o.gridSpacingMm)
      ? { gridSpacingMm: o.gridSpacingMm }
      : {}),
    ...(o.stageShape != null &&
    typeof o.stageShape === "object" &&
    !Array.isArray(o.stageShape)
      ? { stageShape: o.stageShape as StageShape }
      : {}),
    ...(typeof o.hanamichiEnabled === "boolean"
      ? { hanamichiEnabled: o.hanamichiEnabled }
      : {}),
    ...(typeof o.hanamichiDepthPct === "number" && Number.isFinite(o.hanamichiDepthPct)
      ? { hanamichiDepthPct: clamp(o.hanamichiDepthPct, 8, 36) }
      : {}),
    ...(typeof o.dancerMarkerDiameterMm === "number" &&
    Number.isFinite(o.dancerMarkerDiameterMm)
      ? { dancerMarkerDiameterMm: o.dancerMarkerDiameterMm }
      : {}),
    snapGrid: typeof o.snapGrid === "boolean" ? o.snapGrid : false,
    gridStep:
      typeof o.gridStep === "number" && Number.isFinite(o.gridStep)
        ? clamp(o.gridStep, 0.1, 50)
        : 2,
    ...(typeof o.stageGridLinesEnabled === "boolean"
      ? { stageGridLinesEnabled: o.stageGridLinesEnabled }
      : {}),
    ...(typeof o.stageGridLineSpacingMm === "number" &&
    Number.isFinite(o.stageGridLineSpacingMm)
      ? { stageGridLineSpacingMm: clamp(o.stageGridLineSpacingMm, 5, 5000) }
      : {}),
  };
}

/**
 * フローに保存されていたステージ設定をプロジェクトへ上書き適用する。
 */
export function applyFlowStageSettingsToProject(
  project: ChoreographyProjectJson,
  stage: FlowStageSettingsSnapshot
): ChoreographyProjectJson {
  return {
    ...project,
    audienceEdge: stage.audienceEdge,
    stageWidthMm: stage.stageWidthMm,
    stageDepthMm: stage.stageDepthMm,
    sideStageMm: stage.sideStageMm ?? null,
    backStageMm: stage.backStageMm ?? null,
    centerFieldGuideIntervalMm: stage.centerFieldGuideIntervalMm ?? null,
    dancerSpacingMm: stage.dancerSpacingMm,
    gridSpacingMm: stage.gridSpacingMm,
    stageShape: stage.stageShape,
    hanamichiEnabled: stage.hanamichiEnabled,
    hanamichiDepthPct: stage.hanamichiDepthPct,
    dancerMarkerDiameterMm: stage.dancerMarkerDiameterMm,
    snapGrid: stage.snapGrid,
    gridStep: stage.gridStep,
    ...(stage.stageGridLinesEnabled !== undefined
      ? { stageGridLinesEnabled: stage.stageGridLinesEnabled }
      : {}),
    ...(stage.stageGridLineSpacingMm !== undefined
      ? { stageGridLineSpacingMm: stage.stageGridLineSpacingMm }
      : {}),
  };
}

function isValidFormationSnap(x: unknown): x is FlowFormationSnapshot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.dancers)
  );
}

function isValidCueSnap(x: unknown): x is FlowCueSnapshot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.formationIdRef === "string";
}

function isValidItem(x: unknown): x is FlowLibraryItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.formations) &&
    Array.isArray(o.cues)
  );
}

function normalize(raw: FlowLibraryItem): FlowLibraryItem {
  const formations = (raw.formations ?? [])
    .filter(isValidFormationSnap)
    .slice(0, MAX_FORMATIONS)
    .map((f, i) => ({
      id: typeof f.id === "string" && f.id ? f.id : `f${i}`,
      name: (f.name || "").slice(0, MAX_NAME_LEN),
      dancers: (f.dancers ?? [])
        .slice(0, MAX_DANCERS_PER_FORM)
        .map((d, j) => ({
          label: (d.label || String(j + 1)).slice(0, 32),
          xPct: clamp(d.xPct, 0, 100),
          yPct: clamp(d.yPct, 0, 100),
          ...(typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
            ? { colorIndex: modDancerColorIndex(Math.floor(d.colorIndex)) }
            : {}),
          ...(typeof d.note === "string" && d.note.trim()
            ? { note: d.note.slice(0, 2000) }
            : {}),
        })),
    }));
  const formationIds = new Set(formations.map((f) => f.id));
  const cues = (raw.cues ?? [])
    .filter(isValidCueSnap)
    .slice(0, MAX_CUES)
    .filter((c) => formationIds.has(c.formationIdRef))
    .map((c, i) => ({
      id: c.id || `c${i}`,
      name:
        typeof c.name === "string" && c.name.trim()
          ? c.name.slice(0, MAX_NAME_LEN)
          : undefined,
      note:
        typeof c.note === "string" && c.note.trim()
          ? c.note.slice(0, 2000)
          : undefined,
      tStartSec:
        typeof c.tStartSec === "number" && Number.isFinite(c.tStartSec)
          ? c.tStartSec
          : null,
      tEndSec:
        typeof c.tEndSec === "number" && Number.isFinite(c.tEndSec)
          ? c.tEndSec
          : null,
      formationIdRef: c.formationIdRef,
    }));
  const dancerCount = formations[0]?.dancers.length ?? 0;
  const hasTiming = cues.some((c) => c.tStartSec != null && c.tEndSec != null);
  const rawRec = raw as Record<string, unknown>;
  const stageSettings = normalizeStageSettings(rawRec.stageSettings);
  return {
    id: raw.id,
    name: (raw.name || "").slice(0, MAX_NAME_LEN),
    hasTiming,
    dancerCount: clamp(Math.floor(dancerCount), 0, MAX_DANCERS_PER_FORM),
    cueCount: cues.length,
    formations,
    cues,
    ...(stageSettings ? { stageSettings } : {}),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function safeParseAll(): FlowLibraryItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidItem).map(normalize);
  } catch {
    return [];
  }
}

class FlowLibraryQuotaError extends Error {
  constructor() {
    super(
      "ブラウザ内の保存領域が一杯です。古いフローを削除するか、JSON にバックアップしてからやり直してください。"
    );
    this.name = "FlowLibraryQuotaError";
  }
}

function writeAll(items: FlowLibraryItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyChanged();
  } catch (e) {
    const name = (e as { name?: string } | null)?.name ?? "";
    if (
      name === "QuotaExceededError" ||
      name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      throw new FlowLibraryQuotaError();
    }
    throw e;
  }
}

/** 新しい順 */
export function listFlowLibraryItems(): FlowLibraryItem[] {
  return safeParseAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export type FlowSaveResult =
  | { ok: true; item: FlowLibraryItem }
  | { ok: false; reason: "empty" | "quota" | "unknown"; message: string };

/**
 * 現在のプロジェクト状態を新規フローとして保存。
 * 同名のフローも別レコードになる（重複は呼び出し側で制御してもよい）。
 */
export function saveFlowFromProject(
  name: string,
  project: ChoreographyProjectJson,
  opts: { includeTiming: boolean }
): FlowSaveResult {
  const trimmed = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!project.formations.length || !project.cues.length) {
    return {
      ok: false,
      reason: "empty",
      message:
        "保存できるフローがありません。キューを 1 つ以上作ってから保存してください。",
    };
  }
  const cuesSorted = [...project.cues].sort(
    (a, b) => a.tStartSec - b.tStartSec
  );
  /** 使われている formation だけ抽出（孤立した形は持ち込まない） */
  const usedFormationIds = new Set(cuesSorted.map((c) => c.formationId));
  const formations: FlowFormationSnapshot[] = project.formations
    .filter((f) => usedFormationIds.has(f.id))
    .slice(0, MAX_FORMATIONS)
    .map((f) => ({
      id: f.id,
      name: f.name?.slice(0, MAX_NAME_LEN) || "",
      dancers: f.dancers
        .slice(0, MAX_DANCERS_PER_FORM)
        .map((d) => ({
          label: d.label,
          xPct: clamp(d.xPct, 0, 100),
          yPct: clamp(d.yPct, 0, 100),
          ...(typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
            ? { colorIndex: modDancerColorIndex(Math.floor(d.colorIndex)) }
            : {}),
          ...(d.note ? { note: d.note.slice(0, 2000) } : {}),
        })),
    }));
  if (formations.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "キューに紐付く形（フォーメーション）が見つかりません。",
    };
  }
  const cues: FlowCueSnapshot[] = cuesSorted
    .slice(0, MAX_CUES)
    .map((c) => ({
      id: crypto.randomUUID(),
      name:
        typeof c.name === "string" && c.name.trim()
          ? c.name.slice(0, MAX_NAME_LEN)
          : undefined,
      note: c.note ? c.note.slice(0, 2000) : undefined,
      tStartSec: opts.includeTiming ? c.tStartSec : null,
      tEndSec: opts.includeTiming ? c.tEndSec : null,
      formationIdRef: c.formationId,
    }));
  const now = Date.now();
  const item: FlowLibraryItem = {
    id: crypto.randomUUID(),
    name: trimmed || `フロー ${listFlowLibraryItems().length + 1}`,
    hasTiming: opts.includeTiming,
    dancerCount: formations[0]?.dancers.length ?? 0,
    cueCount: cues.length,
    formations,
    cues,
    stageSettings: snapshotStageFromProject(project),
    createdAt: now,
    updatedAt: now,
  };
  const cur = safeParseAll();
  cur.unshift(item);
  try {
    writeAll(cur);
    return { ok: true, item };
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error
          ? e.message
          : "保存中に予期しないエラーが発生しました。",
    };
  }
}

/** 既存フローを「現在のプロジェクト」で上書き（同じ id・名前は維持） */
export function overwriteFlowFromProject(
  id: string,
  project: ChoreographyProjectJson,
  opts: { includeTiming: boolean }
): FlowSaveResult {
  const cur = safeParseAll();
  const target = cur.find((x) => x.id === id);
  if (!target) {
    return {
      ok: false,
      reason: "unknown",
      message: "上書き対象のフローが見つかりませんでした。",
    };
  }
  const fresh = saveFlowFromProject(target.name, project, opts);
  if (!fresh.ok) return fresh;
  const next = cur.map((x) =>
    x.id === id
      ? {
          ...fresh.item,
          id: target.id,
          name: target.name,
          createdAt: target.createdAt,
          updatedAt: Date.now(),
        }
      : x
  );
  try {
    writeAll(next);
    const updated = next.find((x) => x.id === id)!;
    return { ok: true, item: updated };
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error ? e.message : "上書き中にエラーが発生しました。",
    };
  }
}

export function renameFlowItem(id: string, name: string): boolean {
  const trimmed = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!trimmed) return false;
  try {
    writeAll(
      safeParseAll().map((x) =>
        x.id === id ? { ...x, name: trimmed, updatedAt: Date.now() } : x
      )
    );
    return true;
  } catch {
    return false;
  }
}

export function deleteFlowItem(id: string): void {
  try {
    writeAll(safeParseAll().filter((x) => x.id !== id));
  } catch {
    /** 削除はサイズ縮小のみなので基本失敗しない */
  }
}

/**
 * フローを `Formation[]` と `Cue[]` に展開する（呼び出し側でプロジェクトに代入）。
 *
 * - `replaceTiming === false`: タイミングは現在のプロジェクトの長さを目安に等間隔で配り直す
 *   （フローに timing が無いとき／違う曲に当てたいとき）。
 * - `replaceTiming === true` かつフローに timing があるとき: そのまま秒数を復元する。
 *
 * 戻り値は `formations` / `cues` / `activeFormationId`。プロジェクトにそのまま差し込めば良い。
 */
export interface ExpandedFlow {
  formations: Formation[];
  cues: Cue[];
  activeFormationId: string;
  /** フローにステージ設定が含まれるときのみ。呼び出し側でプロジェクトへマージ */
  stageSettings: FlowStageSettingsSnapshot | null;
}

export function expandFlowToProject(
  item: FlowLibraryItem,
  opts: {
    replaceTiming: boolean;
    /** タイミングを置き換えない場合の総尺（秒）。曲の長さなど。 */
    totalDurationSec?: number | null;
    /** タイミングを置き換えない場合の 1 区間の最低長さ（秒） */
    minCueLengthSec?: number;
  }
): ExpandedFlow {
  /** id を新規採番（プロジェクト側の既存 id と衝突しないように） */
  const idMap = new Map<string, string>();
  for (const f of item.formations) {
    idMap.set(f.id, crypto.randomUUID());
  }
  const formations: Formation[] = item.formations.map((f) => ({
    id: idMap.get(f.id)!,
    name: f.name || "",
    setPieces: [],
    dancers: f.dancers.map<DancerSpot>((d, i) => ({
      id: crypto.randomUUID(),
      label: d.label || String(i + 1),
      xPct: d.xPct,
      yPct: d.yPct,
      colorIndex:
        typeof d.colorIndex === "number"
          ? modDancerColorIndex(d.colorIndex)
          : modDancerColorIndex(i),
      ...(d.note ? { note: d.note } : {}),
    })),
  }));

  const useTiming = opts.replaceTiming && item.hasTiming;
  const cuesOut: Cue[] = item.cues.map((c, i) => {
    const fid = idMap.get(c.formationIdRef);
    if (!fid) {
      /** 通常は normalize でフィルタ済みだが、防衛 */
      return null as unknown as Cue;
    }
    return {
      id: crypto.randomUUID(),
      tStartSec:
        useTiming && c.tStartSec != null ? c.tStartSec : i,
      tEndSec:
        useTiming && c.tEndSec != null
          ? c.tEndSec
          : i + Math.max(0.5, opts.minCueLengthSec ?? 1),
      formationId: fid,
      ...(c.name ? { name: c.name } : {}),
      ...(c.note ? { note: c.note } : {}),
    };
  });

  /**
   * タイミング置換しない場合は、`totalDurationSec` の範囲に等間隔で配り直す。
   * 区間の隙間ができないよう、cue.tEnd と次の cue.tStart は隣接させる。
   */
  if (!useTiming) {
    const total = Math.max(
      Math.max(0.5, opts.minCueLengthSec ?? 1) * cuesOut.length,
      opts.totalDurationSec && opts.totalDurationSec > 0
        ? opts.totalDurationSec
        : Math.max(2, cuesOut.length)
    );
    const step = total / cuesOut.length;
    cuesOut.forEach((c, i) => {
      c.tStartSec = step * i;
      c.tEndSec = step * (i + 1);
    });
  }

  const activeFormationId = formations[0]?.id ?? "";
  const stageSettings =
    item.stageSettings != null
      ? normalizeStageSettings(item.stageSettings) ?? null
      : null;
  return { formations, cues: cuesOut, activeFormationId, stageSettings };
}

/** バックアップ: フロー全件を JSON 文字列に */
export function exportFlowLibraryJson(): string {
  return JSON.stringify(
    { version: 1, items: listFlowLibraryItems() },
    null,
    2
  );
}

/** 取り込み: JSON テキストから取り込み（重複は ID マージ・新しい方を採用） */
export function importFlowLibraryJson(text: string): {
  added: number;
  updated: number;
  skipped: number;
  message?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      message: e instanceof Error ? e.message : "JSON の解析に失敗しました。",
    };
  }
  const items =
    parsed && typeof parsed === "object" && "items" in (parsed as object)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : [];
  const valid: FlowLibraryItem[] = items
    .filter(isValidItem)
    .map(normalize);
  const cur = safeParseAll();
  const byId = new Map(cur.map((x) => [x.id, x]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const it of valid) {
    const existing = byId.get(it.id);
    if (!existing) {
      byId.set(it.id, it);
      added++;
    } else if (it.updatedAt > existing.updatedAt) {
      byId.set(it.id, it);
      updated++;
    } else {
      skipped++;
    }
  }
  try {
    writeAll([...byId.values()]);
    return { added, updated, skipped };
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { added: 0, updated: 0, skipped: 0, message: e.message };
    }
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      message:
        e instanceof Error ? e.message : "取り込み中にエラーが発生しました。",
    };
  }
}

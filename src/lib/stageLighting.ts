import type { Cue, StageLightFixture, StageLightKind } from "../types/choreography";

/** 客席側（y=100）からの距離 mm → メイン床 yPct（下が客席の正規座標） */
export function yPctFromFrontMm(
  fromFrontMm: number,
  stageDepthMm: number
): number | null {
  if (!(stageDepthMm > 0) || !Number.isFinite(fromFrontMm) || fromFrontMm < 0) {
    return null;
  }
  const y = 100 - (fromFrontMm / stageDepthMm) * 100;
  return Math.min(100, Math.max(0, y));
}

export function normalizeDepthMmList(raw: unknown, max = 24): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const mm = Math.max(100, Math.min(50_000, Math.round(v)));
    if (seen.has(mm)) continue;
    seen.add(mm);
    out.push(mm);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a - b);
}

export function formatDepthMmLabel(mm: number): string {
  if (mm % 1000 === 0) return `前から ${mm / 1000} m`;
  if (mm % 10 === 0) return `前から ${(mm / 10).toFixed(0)} cm`;
  return `前から ${mm} mm`;
}

export const STAGE_LIGHT_KIND_LABELS: Record<StageLightKind, string> = {
  suspension: "サスペンション",
  sideSpot: "サイドスポット",
  backlight: "バックライト",
  footlight: "フットライト",
  pinSpot: "ピンスポ",
};

export const STAGE_LIGHT_KINDS = Object.keys(
  STAGE_LIGHT_KIND_LABELS
) as StageLightKind[];

/**
 * 照明の色パレット（設定パネル・ステージ上メニュー共通）。
 * 白〜パステルに加え、識別しやすいビビッド色を多めに揃える。
 */
export const STAGE_LIGHT_COLOR_SWATCHES = [
  "#ffffff",
  "#fef08a",
  "#fcd34d",
  "#eab308",
  "#fb923c",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#f87171",
  "#ec4899",
  "#f472b6",
  "#d946ef",
  "#c084fc",
  "#a855f7",
  "#6366f1",
  "#3b82f6",
  "#60a5fa",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#22c55e",
  "#34d399",
  "#84cc16",
  "#a3e635",
] as const;

/** プロジェクトあたりの照明上限 */
export const STAGE_LIGHTS_MAX = 80;

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampAxis(v: number): number {
  return Math.max(2, Math.min(60, v));
}

/** 種類ごとの既定ビーム半径（メイン床 %） */
export function defaultRadiusPctForKind(kind: StageLightKind): number {
  switch (kind) {
    case "pinSpot":
      return 8;
    case "suspension":
      return 22;
    case "footlight":
    case "backlight":
      return 28;
    default:
      return 16;
  }
}

/** @deprecated resolveLightAxes を使う */
export function resolveLightRadiusPct(L: StageLightFixture): number {
  return resolveLightAxes(L).rx;
}

export function resolveLightShape(
  L: StageLightFixture
): "circle" | "ellipse" {
  return L.shape === "circle" ? "circle" : "ellipse";
}

/**
 * 描画用の横・縦半径（viewBox %）。
 * circle かつ floorAspect(幅/高さ) があるとき、見た目が正円になるよう ry を補正する。
 */
export function resolveLightAxes(
  L: StageLightFixture,
  floorAspect?: number | null
): { rx: number; ry: number; shape: "circle" | "ellipse" } {
  const shape = resolveLightShape(L);
  const legacy =
    typeof L.radiusPct === "number" && Number.isFinite(L.radiusPct)
      ? L.radiusPct
      : defaultRadiusPctForKind(L.kind);
  const rx = clampAxis(
    typeof L.rxPct === "number" && Number.isFinite(L.rxPct) ? L.rxPct : legacy
  );
  if (shape === "circle") {
    const aspect =
      floorAspect != null && floorAspect > 0.15 && floorAspect < 8
        ? floorAspect
        : 1;
    // preserveAspectRatio=none のため、画面上の正円は ry = rx * (W/H) = rx * aspect
    return { rx, ry: clampAxis(rx * aspect), shape };
  }
  const ry = clampAxis(
    typeof L.ryPct === "number" && Number.isFinite(L.ryPct)
      ? L.ryPct
      : rx * 0.72
  );
  return { rx, ry, shape };
}

export function createDefaultStageLight(
  kind: StageLightKind = "sideSpot"
): StageLightFixture {
  const presets: Record<
    StageLightKind,
    Pick<StageLightFixture, "xPct" | "yPct" | "color" | "intensity">
  > = {
    suspension: { xPct: 50, yPct: 35, color: "#fef08a", intensity: 0.35 },
    sideSpot: { xPct: 12, yPct: 55, color: "#fb923c", intensity: 0.4 },
    backlight: { xPct: 50, yPct: 18, color: "#60a5fa", intensity: 0.3 },
    footlight: { xPct: 50, yPct: 88, color: "#f472b6", intensity: 0.35 },
    pinSpot: { xPct: 50, yPct: 50, color: "#ffffff", intensity: 0.55 },
  };
  const p = presets[kind];
  const r = defaultRadiusPctForKind(kind);
  return {
    id: crypto.randomUUID(),
    kind,
    label: STAGE_LIGHT_KIND_LABELS[kind],
    xPct: p.xPct,
    yPct: p.yPct,
    color: p.color,
    intensity: p.intensity,
    rxPct: r,
    ryPct: Math.round(r * 0.72 * 10) / 10,
    shape: "ellipse",
    cueId: null,
    tStartSec: null,
    tEndSec: null,
    enabled: true,
  };
}

export function normalizeStageLights(raw: unknown): StageLightFixture[] {
  if (!Array.isArray(raw)) return [];
  const out: StageLightFixture[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    if (
      kind !== "suspension" &&
      kind !== "sideSpot" &&
      kind !== "backlight" &&
      kind !== "footlight" &&
      kind !== "pinSpot"
    ) {
      continue;
    }
    const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
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
        : "#fef08a";
    const intensity =
      typeof o.intensity === "number" && Number.isFinite(o.intensity)
        ? clamp01(o.intensity)
        : 0.35;
    const legacyR =
      typeof o.radiusPct === "number" && Number.isFinite(o.radiusPct)
        ? clampAxis(o.radiusPct)
        : undefined;
    const rxPct =
      typeof o.rxPct === "number" && Number.isFinite(o.rxPct)
        ? clampAxis(o.rxPct)
        : legacyR;
    const ryPct =
      typeof o.ryPct === "number" && Number.isFinite(o.ryPct)
        ? clampAxis(o.ryPct)
        : undefined;
    const shape = o.shape === "circle" ? "circle" : "ellipse";
    const cueId =
      typeof o.cueId === "string" && o.cueId.trim()
        ? o.cueId.trim().slice(0, 64)
        : null;
    const tStartSec =
      typeof o.tStartSec === "number" && Number.isFinite(o.tStartSec)
        ? Math.max(0, o.tStartSec)
        : null;
    const tEndSec =
      typeof o.tEndSec === "number" && Number.isFinite(o.tEndSec)
        ? Math.max(0, o.tEndSec)
        : null;
    out.push({
      id,
      kind,
      label:
        typeof o.label === "string" && o.label.trim()
          ? o.label.trim().slice(0, 40)
          : STAGE_LIGHT_KIND_LABELS[kind],
      xPct,
      yPct,
      color,
      intensity,
      ...(rxPct != null ? { rxPct } : legacyR != null ? { rxPct: legacyR } : {}),
      ...(ryPct != null ? { ryPct } : {}),
      shape,
      cueId,
      tStartSec,
      tEndSec,
      enabled: o.enabled === false ? false : true,
    });
    if (out.length >= STAGE_LIGHTS_MAX) break;
  }
  return out;
}

export type StageLightCueBound = Pick<Cue, "id" | "tStartSec" | "tEndSec">;

export type ActiveStageLightsOptions = {
  /** キュー紐づけ照明の判定用 */
  cues?: readonly StageLightCueBound[] | null;
  /**
   * 編集中のキュー。指定時はそのキュー紐づけ照明を時間外でも表示する。
   */
  focusCueId?: string | null;
  /**
   * キューとキューのあいだで、直前キューの照明を引き継ぐ（既定 true）。
   * その区間に専用の全体照明があるときは引き継がない。
   */
  carryPrevCueLights?: boolean;
};

/** 時刻 t が属するキュー。ギャップなら直前キュー ID（なければ null） */
export function resolveLightingCueIdAtTime(
  cues: readonly StageLightCueBound[],
  tSec: number
): { cueId: string; inCue: boolean } | null {
  if (!cues.length || !Number.isFinite(tSec)) return null;
  const sorted = [...cues].sort(
    (a, b) =>
      a.tStartSec - b.tStartSec ||
      a.tEndSec - b.tEndSec ||
      a.id.localeCompare(b.id)
  );

  let containing: StageLightCueBound | null = null;
  for (const c of sorted) {
    if (tSec + 1e-9 >= c.tStartSec && tSec - 1e-9 <= c.tEndSec) {
      containing = c;
    }
  }
  if (containing) return { cueId: containing.id, inCue: true };

  let prev: StageLightCueBound | null = null;
  for (const c of sorted) {
    if (c.tEndSec < tSec - 1e-9) prev = c;
  }
  if (prev) return { cueId: prev.id, inCue: false };
  return null;
}

/** ギャップ区間にちょうど収まる全体照明があるか */
export function gapHasDedicatedLights(
  lights: readonly StageLightFixture[],
  gapStartSec: number,
  gapEndSec: number
): boolean {
  if (!(gapEndSec > gapStartSec + 0.02)) return false;
  return lights.some((L) => {
    if (L.enabled === false || L.cueId) return false;
    const a = L.tStartSec;
    const b = L.tEndSec;
    if (a == null || b == null) return false;
    return a + 1e-6 >= gapStartSec && b - 1e-6 <= gapEndSec;
  });
}

/**
 * 現在時刻（と任意でフォーカス中キュー）で点灯中の照明。
 * - cueId あり + focusCueId あり → そのキューの灯だけ（他キューは時間外でも出さない）
 * - cueId あり + focus なし → キュー区間内。ギャップでは直前キューを引き継ぐ（専用灯が無いとき）
 * - cueId なし → tStart/tEnd（全体）
 */
export function activeStageLightsAtTime(
  lights: readonly StageLightFixture[] | null | undefined,
  tSec: number,
  options?: ActiveStageLightsOptions
): StageLightFixture[] {
  if (!lights?.length || !Number.isFinite(tSec)) return [];
  const cues = options?.cues ?? null;
  const focusCueId = options?.focusCueId ?? null;
  const carryPrev = options?.carryPrevCueLights !== false;

  let activeCueId: string | null = null;
  let inCue = true;
  if (focusCueId != null) {
    activeCueId = focusCueId;
    inCue = true;
  } else if (cues?.length) {
    const resolved = resolveLightingCueIdAtTime(cues, tSec);
    if (resolved) {
      activeCueId = resolved.cueId;
      inCue = resolved.inCue;
      if (!inCue && carryPrev) {
        const sorted = [...cues].sort(
          (a, b) =>
            a.tStartSec - b.tStartSec ||
            a.tEndSec - b.tEndSec ||
            a.id.localeCompare(b.id)
        );
        const prevIdx = sorted.findIndex((c) => c.id === activeCueId);
        const prev = prevIdx >= 0 ? sorted[prevIdx]! : null;
        const next = prevIdx >= 0 ? sorted[prevIdx + 1] : undefined;
        // 次キューまでのギャップに専用全体照明があれば、キュー灯の引き継ぎはしない
        if (
          prev &&
          next &&
          gapHasDedicatedLights(lights, prev.tEndSec, next.tStartSec)
        ) {
          activeCueId = null;
        }
      } else if (!inCue && !carryPrev) {
        activeCueId = null;
      }
    }
  }

  return lights.filter((L) => {
    if (L.enabled === false) return false;

    if (L.cueId) {
      if (activeCueId == null) return false;
      return L.cueId === activeCueId;
    }

    const a = L.tStartSec;
    const b = L.tEndSec;
    if (a != null && tSec + 1e-9 < a) return false;
    if (b != null && tSec - 1e-9 > b) return false;
    return true;
  });
}

/** 直前キューの照明を、ギャップ時間帯の全体照明として複製 */
export function cloneCueLightsIntoGapWindow(
  lights: readonly StageLightFixture[],
  fromCueId: string,
  gapStartSec: number,
  gapEndSec: number
): StageLightFixture[] {
  const room = STAGE_LIGHTS_MAX - lights.length;
  if (room <= 0) return [...lights];
  const start = Math.max(0, gapStartSec);
  const end = Math.max(start + 0.05, gapEndSec);
  const cloned = lights
    .filter((L) => L.cueId === fromCueId)
    .slice(0, room)
    .map((L) => ({
      ...L,
      id: crypto.randomUUID(),
      cueId: null,
      tStartSec: start,
      tEndSec: end,
      label: `${(L.label ?? STAGE_LIGHT_KIND_LABELS[L.kind]).replace(
        /\s*移動\d*$/,
        ""
      )} 移動`,
    }));
  return [...lights, ...cloned];
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(254,240,138,${clamp01(alpha)})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

/** 同種照明の次の通し番号ラベル */
export function nextLightLabel(
  kind: StageLightKind,
  existing: readonly StageLightFixture[]
): string {
  const base = STAGE_LIGHT_KIND_LABELS[kind];
  const n =
    existing.filter((L) => L.kind === kind).length + 1;
  return n <= 1 ? base : `${base} ${n}`;
}

/** 基本照明セットのパート色（濃いめ・識別しやすい） */
export const BASIC_STAGE_LIGHT_COLORS: Record<StageLightKind, string> = {
  backlight: "#eab308", // 濃い黄（舞台裏）
  sideSpot: "#ef4444", // 濃い赤（サイド）
  suspension: "#22c55e", // 濃い緑（サス）
  footlight: "#d946ef", // 濃いマゼンタ（フット）
  pinSpot: "#ffffff", // 白（ピン・ヘソ）
};

function basicLightAt(
  kind: StageLightKind,
  xPct: number,
  yPct: number,
  cueId: string | null,
  opts?: {
    label?: string;
    rxPct?: number;
    ryPct?: number;
    intensity?: number;
    shape?: "circle" | "ellipse";
  }
): StageLightFixture {
  const r = defaultRadiusPctForKind(kind);
  const rx = opts?.rxPct ?? r;
  const ry = opts?.ryPct ?? Math.round(r * 0.72 * 10) / 10;
  return {
    id: crypto.randomUUID(),
    kind,
    label: opts?.label ?? STAGE_LIGHT_KIND_LABELS[kind],
    xPct: clampPct(xPct),
    yPct: clampPct(yPct),
    color: BASIC_STAGE_LIGHT_COLORS[kind],
    intensity: opts?.intensity ?? (kind === "pinSpot" ? 0.85 : 0.72),
    rxPct: clampAxis(rx),
    ryPct: clampAxis(ry),
    shape: opts?.shape ?? "ellipse",
    cueId,
    tStartSec: null,
    tEndSec: null,
    enabled: true,
  };
}

/**
 * 基本照明一式（濃いめ・指定本数・参照画像の範囲感）。
 * サイド左右各3・フット3・サス上手/下手2・ピンヘソ1・バック2。
 */
export function createBasicStageLights(
  cueId: string | null = null
): StageLightFixture[] {
  const L = cueId;

  // バックライト: 舞台裏 2 灯（黄）— やや小さめの円
  const back = [
    basicLightAt("backlight", 30, 12, L, {
      label: "バックライト 下手",
      rxPct: 14,
      ryPct: 11,
      intensity: 0.75,
    }),
    basicLightAt("backlight", 70, 12, L, {
      label: "バックライト 上手",
      rxPct: 14,
      ryPct: 11,
      intensity: 0.75,
    }),
  ];

  // サイドスポット: 左右各 3・横長だが中央まで伸ばさない
  const sideYs = [28, 50, 72];
  const sideLeft = sideYs.map((y, i) =>
    basicLightAt("sideSpot", 10, y, L, {
      label: `サイドスポット 下手${i + 1}`,
      rxPct: 12,
      ryPct: 7,
      intensity: 0.78,
    })
  );
  const sideRight = sideYs.map((y, i) =>
    basicLightAt("sideSpot", 90, y, L, {
      label: `サイドスポット 上手${i + 1}`,
      rxPct: 12,
      ryPct: 7,
      intensity: 0.78,
    })
  );

  // サスペンション: 上手・下手（緑）— 中央帯を埋めない大きさ
  const suspension = [
    basicLightAt("suspension", 28, 48, L, {
      label: "サスペンション 下手",
      rxPct: 16,
      ryPct: 14,
      intensity: 0.7,
      shape: "circle",
    }),
    basicLightAt("suspension", 72, 48, L, {
      label: "サスペンション 上手",
      rxPct: 16,
      ryPct: 14,
      intensity: 0.7,
      shape: "circle",
    }),
  ];

  // フットライト: 客席側 3 灯（マゼンタ）
  const footXs = [25, 50, 75];
  const foot = footXs.map((x, i) =>
    basicLightAt("footlight", x, 90, L, {
      label: `フットライト ${i + 1}`,
      rxPct: 13,
      ryPct: 8,
      intensity: 0.75,
    })
  );

  // ピンスポ: ヘソ 1 灯（白）— ヘソ付近だけ照らす
  const pin = [
    basicLightAt("pinSpot", 50, 50, L, {
      label: "ピンスポ ヘソ",
      rxPct: 9,
      ryPct: 9,
      intensity: 0.88,
      shape: "circle",
    }),
  ];

  return [...back, ...sideLeft, ...sideRight, ...suspension, ...foot, ...pin];
}

/** 直前キューに紐づく照明を、指定キュー向けに複製して返す */
export function cloneLightsFromCue(
  lights: readonly StageLightFixture[],
  fromCueId: string,
  toCueId: string
): StageLightFixture[] {
  return lights
    .filter((L) => L.cueId === fromCueId)
    .map((L) => ({
      ...L,
      id: crypto.randomUUID(),
      cueId: toCueId,
      tStartSec: null,
      tEndSec: null,
    }));
}

/** 既存に基本照明を追加（上限まで） */
export function appendBasicStageLights(
  existing: readonly StageLightFixture[],
  cueId: string | null
): StageLightFixture[] {
  const room = STAGE_LIGHTS_MAX - existing.length;
  if (room <= 0) return [...existing];
  const added = createBasicStageLights(cueId).slice(0, room);
  return [...existing, ...added];
}

/** 直前キューの照明を現キューへコピーして追記 */
export function appendClonedLightsFromPreviousCue(
  existing: readonly StageLightFixture[],
  fromCueId: string,
  toCueId: string
): StageLightFixture[] {
  const room = STAGE_LIGHTS_MAX - existing.length;
  if (room <= 0) return [...existing];
  const cloned = cloneLightsFromCue(existing, fromCueId, toCueId).slice(
    0,
    room
  );
  return [...existing, ...cloned];
}

import type { StageLightFixture, StageLightKind } from "../types/choreography";

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

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
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
  return {
    id: crypto.randomUUID(),
    kind,
    label: STAGE_LIGHT_KIND_LABELS[kind],
    xPct: p.xPct,
    yPct: p.yPct,
    color: p.color,
    intensity: p.intensity,
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
      tStartSec,
      tEndSec,
      enabled: o.enabled === false ? false : true,
    });
    if (out.length >= 40) break;
  }
  return out;
}

/** 現在時刻で点灯中の照明 */
export function activeStageLightsAtTime(
  lights: readonly StageLightFixture[] | null | undefined,
  tSec: number
): StageLightFixture[] {
  if (!lights?.length || !Number.isFinite(tSec)) return [];
  return lights.filter((L) => {
    if (L.enabled === false) return false;
    const a = L.tStartSec;
    const b = L.tEndSec;
    if (a != null && tSec + 1e-9 < a) return false;
    if (b != null && tSec - 1e-9 > b) return false;
    return true;
  });
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(254,240,138,${clamp01(alpha)})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

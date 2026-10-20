import type {
  StageSleeveCurtain,
  StageSleeveCurtainSide,
} from "../types/choreography";
import { normalizeDepthMmList, yPctFromFrontMm } from "./stageLighting";

const SIDES: readonly StageSleeveCurtainSide[] = ["both", "left", "right"];

export function createDefaultSleeveCurtain(
  depthMm = 2000,
  label?: string
): StageSleeveCurtain {
  return {
    id: crypto.randomUUID(),
    depthMm: Math.max(100, Math.min(50_000, Math.round(depthMm))),
    label: label ?? `そで幕`,
    side: "both",
    /** 舞台端から内側へ */
    insetMm: 450,
    /** 未指定＝そでスペースがあるとき全幅まで */
    wingExtentMm: undefined,
  };
}

function normalizeSide(raw: unknown): StageSleeveCurtainSide {
  return SIDES.includes(raw as StageSleeveCurtainSide)
    ? (raw as StageSleeveCurtainSide)
    : "both";
}

export function normalizeStageSleeveCurtains(
  rawCurtains: unknown,
  legacyDepthsMm: unknown,
  max = 24
): StageSleeveCurtain[] {
  const out: StageSleeveCurtain[] = [];
  const seenIds = new Set<string>();

  if (Array.isArray(rawCurtains)) {
    for (const item of rawCurtains) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const depthMm =
        typeof o.depthMm === "number" && Number.isFinite(o.depthMm) && o.depthMm > 0
          ? Math.max(100, Math.min(50_000, Math.round(o.depthMm)))
          : null;
      if (depthMm == null) continue;
      const id =
        typeof o.id === "string" && o.id.trim()
          ? o.id.trim().slice(0, 64)
          : crypto.randomUUID();
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const label =
        typeof o.label === "string" && o.label.trim()
          ? o.label.trim().slice(0, 48)
          : undefined;
      const insetMm =
        typeof o.insetMm === "number" && Number.isFinite(o.insetMm) && o.insetMm >= 0
          ? Math.max(0, Math.min(20_000, Math.round(o.insetMm)))
          : undefined;
      const wingExtentMm =
        typeof o.wingExtentMm === "number" && Number.isFinite(o.wingExtentMm)
          ? Math.max(0, Math.min(20_000, Math.round(o.wingExtentMm)))
          : undefined;
      out.push({
        id,
        depthMm,
        ...(label ? { label } : {}),
        side: normalizeSide(o.side),
        ...(insetMm != null ? { insetMm } : {}),
        ...(wingExtentMm != null ? { wingExtentMm } : {}),
      });
      if (out.length >= max) return out;
    }
  }

  if (out.length === 0) {
    for (const mm of normalizeDepthMmList(legacyDepthsMm, max)) {
      out.push(createDefaultSleeveCurtain(mm, `そで幕 ${out.length + 1}`));
    }
  }

  return out.sort((a, b) => a.depthMm - b.depthMm || a.id.localeCompare(b.id));
}

export function sleeveCurtainsToDepthsMm(
  curtains: readonly StageSleeveCurtain[] | null | undefined
): number[] {
  if (!curtains?.length) return [];
  return normalizeDepthMmList(curtains.map((c) => c.depthMm));
}

export type SleeveCurtainMark = {
  id: string;
  yPct: number;
  depthMm: number;
  label: string;
  side: StageSleeveCurtainSide;
  /** 舞台端からメイン内側へ（メイン幅に対する %） */
  insetPct: number;
  insetMm: number;
  /** 舞台端からそで側へ（メイン幅に対する %） */
  wingPct: number;
  wingExtentMm: number;
};

/**
 * 基準は舞台端（メイン床の左右端）。
 * - insetMm: 端から内側へ
 * - wingExtentMm: 端からそでスペースへ（未指定ならサイド全幅）
 */
export function buildSleeveCurtainMarksFromCurtains(
  curtains: readonly StageSleeveCurtain[] | null | undefined,
  stageDepthMm: number | null | undefined,
  stageWidthMm: number | null | undefined,
  sideStageMm: number | null | undefined = null
): SleeveCurtainMark[] {
  if (!curtains?.length || !(stageDepthMm && stageDepthMm > 0)) return [];
  const W = stageWidthMm && stageWidthMm > 0 ? stageWidthMm : 10_000;
  const side = sideStageMm && sideStageMm > 0 ? sideStageMm : 0;
  const maxInsetMm = Math.max(0, Math.round(W * 0.5));
  const out: SleeveCurtainMark[] = [];
  for (const c of curtains) {
    const yPct = yPctFromFrontMm(c.depthMm, stageDepthMm);
    if (yPct == null) continue;
    const insetMm = Math.min(maxInsetMm, Math.max(0, c.insetMm ?? 450));
    const wingExtentMm =
      c.wingExtentMm != null
        ? Math.min(side, Math.max(0, c.wingExtentMm))
        : side;
    const insetPct = (insetMm / W) * 100;
    const wingPct = side > 0 ? (wingExtentMm / W) * 100 : 0;
    out.push({
      id: c.id,
      yPct,
      depthMm: c.depthMm,
      label: c.label?.trim() || "そで幕",
      side: c.side ?? "both",
      insetPct,
      insetMm,
      wingPct,
      wingExtentMm,
    });
  }
  return out;
}

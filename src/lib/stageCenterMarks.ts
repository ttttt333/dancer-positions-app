import type { StageCenterMark } from "../types/choreography";

export const STAGE_CENTER_MARKS_MAX = 24;

/** 互換・既定の横半径（床幅 %）。旧固定描画 ≈ 1.6 に近い見え方 */
export const STAGE_CENTER_MARK_RX_DEFAULT = 2.5;
export const STAGE_CENTER_MARK_RX_MIN = 0.5;
export const STAGE_CENTER_MARK_RX_MAX = 40;

export function clampCenterMarkPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function clampCenterMarkAxis(n: number): number {
  if (!Number.isFinite(n)) return STAGE_CENTER_MARK_RX_DEFAULT;
  return Math.max(
    STAGE_CENTER_MARK_RX_MIN,
    Math.min(STAGE_CENTER_MARK_RX_MAX, Math.round(n * 10) / 10)
  );
}

export function resolveCenterMarkShape(
  m: Pick<StageCenterMark, "shape">
): "circle" | "ellipse" {
  return m.shape === "ellipse" ? "ellipse" : "circle";
}

/**
 * 描画用の横・縦半径（viewBox %）。
 * circle かつ floorAspect(幅/高さ) があるとき、見た目が正円になるよう ry を補正する。
 */
export function resolveCenterMarkAxes(
  m: Pick<StageCenterMark, "rxPct" | "ryPct" | "shape">,
  floorAspect?: number | null
): { rx: number; ry: number; shape: "circle" | "ellipse" } {
  const shape = resolveCenterMarkShape(m);
  const rx = clampCenterMarkAxis(
    typeof m.rxPct === "number" && Number.isFinite(m.rxPct)
      ? m.rxPct
      : STAGE_CENTER_MARK_RX_DEFAULT
  );
  if (shape === "circle") {
    const aspect =
      floorAspect != null && floorAspect > 0.15 && floorAspect < 8
        ? floorAspect
        : 1;
    // preserveAspectRatio=none のため、画面上の正円は ry = rx * (W/H)
    return { rx, ry: clampCenterMarkAxis(rx * aspect), shape };
  }
  const ry = clampCenterMarkAxis(
    typeof m.ryPct === "number" && Number.isFinite(m.ryPct)
      ? m.ryPct
      : rx * 0.72
  );
  return { rx, ry, shape };
}

export function createDefaultCenterMark(
  xPct = 50,
  yPct = 50,
  label = "ヘソ"
): StageCenterMark {
  return {
    id: crypto.randomUUID(),
    xPct: clampCenterMarkPct(xPct),
    yPct: clampCenterMarkPct(yPct),
    label,
    rxPct: STAGE_CENTER_MARK_RX_DEFAULT,
    shape: "circle",
  };
}

function normalizeShape(raw: unknown): "circle" | "ellipse" {
  return raw === "ellipse" ? "ellipse" : "circle";
}

/**
 * 読み込み正規化。
 * 旧データ（stageHesoVisible のみ）は中央に 1 点を生やす。
 */
export function normalizeStageCenterMarks(
  raw: unknown,
  opts?: { seedCenterIfEmpty?: boolean }
): StageCenterMark[] {
  const out: StageCenterMark[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const xPct =
        typeof o.xPct === "number" && Number.isFinite(o.xPct)
          ? clampCenterMarkPct(o.xPct)
          : null;
      const yPct =
        typeof o.yPct === "number" && Number.isFinite(o.yPct)
          ? clampCenterMarkPct(o.yPct)
          : null;
      if (xPct == null || yPct == null) continue;
      const id =
        typeof o.id === "string" && o.id.trim()
          ? o.id.trim().slice(0, 64)
          : crypto.randomUUID();
      if (seen.has(id)) continue;
      seen.add(id);
      const label =
        typeof o.label === "string" && o.label.trim()
          ? o.label.trim().slice(0, 48)
          : undefined;
      const shape = normalizeShape(o.shape);
      const rxPct =
        typeof o.rxPct === "number" && Number.isFinite(o.rxPct)
          ? clampCenterMarkAxis(o.rxPct)
          : STAGE_CENTER_MARK_RX_DEFAULT;
      const ryPct =
        typeof o.ryPct === "number" && Number.isFinite(o.ryPct)
          ? clampCenterMarkAxis(o.ryPct)
          : undefined;
      out.push({
        id,
        xPct,
        yPct,
        ...(label ? { label } : {}),
        rxPct,
        shape,
        ...(shape === "ellipse"
          ? { ryPct: ryPct ?? clampCenterMarkAxis(rxPct * 0.72) }
          : ryPct != null
            ? { ryPct }
            : {}),
      });
      if (out.length >= STAGE_CENTER_MARKS_MAX) break;
    }
  }

  if (out.length === 0 && opts?.seedCenterIfEmpty) {
    out.push(createDefaultCenterMark(50, 50, "ヘソ"));
  }
  return out;
}

/** 次の追加位置（重ならないよう少しずらす） */
export function nextCenterMarkOffset(
  existing: readonly StageCenterMark[]
): { xPct: number; yPct: number } {
  const n = existing.length;
  const dx = (n % 5) * 4;
  const dy = Math.floor(n / 5) * 4;
  return {
    xPct: clampCenterMarkPct(50 + dx),
    yPct: clampCenterMarkPct(50 + dy),
  };
}

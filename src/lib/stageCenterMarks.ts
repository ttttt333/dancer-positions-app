import type { StageCenterMark } from "../types/choreography";

export const STAGE_CENTER_MARKS_MAX = 24;

export function clampCenterMarkPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
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
  };
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
      out.push({
        id,
        xPct,
        yPct,
        ...(label ? { label } : {}),
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

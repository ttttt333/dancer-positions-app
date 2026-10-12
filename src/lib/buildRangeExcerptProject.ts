import type { ChoreographyProjectJson } from "../types/choreography";

/** "2:05" / "125" / "1:02:03" → 秒。読めなければ null */
export function parseClockToSec(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(":").map((x) => x.trim());
  if (parts.some((x) => !/^\d+(\.\d+)?$/.test(x))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + Number(p);
  return Number.isFinite(sec) ? sec : null;
}

export function formatSecToClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 生徒に一部だけ見せる用のコピー。
 * - 範囲に重なるキューだけ残し、キューの時間は範囲内に切り詰める（音源と時刻はそのまま）
 * - 残ったキューが使わない立ち位置・照明は入れない（範囲外を見せない）
 * - 再生範囲（トリム）を開始〜終了に合わせる
 */
export function buildRangeExcerptProject(
  p: ChoreographyProjectJson,
  startSec: number,
  endSec: number
): ChoreographyProjectJson {
  const t0 = Math.max(0, Math.min(startSec, endSec));
  const t1 = Math.max(startSec, endSec);

  const cues = p.cues
    .filter((c) => c.tEndSec > t0 && c.tStartSec < t1)
    .map((c) => ({
      ...c,
      tStartSec: Math.max(c.tStartSec, t0),
      tEndSec: Math.min(c.tEndSec, t1),
    }));
  const keptCueIds = new Set(cues.map((c) => c.id));
  const usedFormationIds = new Set(cues.map((c) => c.formationId));

  const sortedCues = [...cues].sort((a, b) => a.tStartSec - b.tStartSec);
  const fallbackFormationId =
    sortedCues[0]?.formationId ??
    (p.formations.some((f) => f.id === p.activeFormationId)
      ? p.activeFormationId
      : p.formations[0]?.id ?? p.activeFormationId);
  usedFormationIds.add(fallbackFormationId);

  const stageLights = (p.stageLights ?? [])
    .filter((L) => {
      if (L.cueId) return keptCueIds.has(L.cueId);
      const a = L.tStartSec ?? -Infinity;
      const b = L.tEndSec ?? Infinity;
      return b > t0 && a < t1;
    })
    .map((L) => {
      if (L.cueId) return L;
      return {
        ...L,
        ...(L.tStartSec != null ? { tStartSec: Math.max(L.tStartSec, t0) } : {}),
        ...(L.tEndSec != null ? { tEndSec: Math.min(L.tEndSec, t1) } : {}),
      };
    });

  return {
    ...p,
    cues,
    formations: p.formations.filter((f) => usedFormationIds.has(f.id)),
    activeFormationId: fallbackFormationId,
    stageLights,
    trimStartSec: t0,
    trimEndSec: t1,
    viewMode: "view",
  };
}

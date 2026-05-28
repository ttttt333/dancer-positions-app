export type ProjectThumbDancer = {
  xPct: number;
  yPct: number;
  colorIndex: number;
};

export type ProjectListSummary = {
  dancerCount: number;
  cueCount: number;
  previewDancers: ProjectThumbDancer[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function pickFirstFormation(
  formations: Record<string, unknown>[],
  cues: Record<string, unknown>[],
  activeFormationId: unknown
): Record<string, unknown> | null {
  if (cues.length > 0) {
    const sorted = [...cues].sort(
      (a, b) => Number(a.tStartSec ?? 0) - Number(b.tStartSec ?? 0)
    );
    const firstCue = sorted[0];
    const fid = firstCue?.formationId;
    if (typeof fid === "string") {
      const linked = formations.find((f) => f.id === fid);
      if (linked) return linked;
    }
  }
  if (typeof activeFormationId === "string") {
    const active = formations.find((f) => f.id === activeFormationId);
    if (active) return active;
  }
  return formations[0] ?? null;
}

/** 一覧サムネ用: 先頭キューのフォーメーション（なければ active / 先頭）を要約 */
export function summarizeProjectJson(raw: unknown): ProjectListSummary {
  const o = asRecord(raw);
  if (!o) {
    return { dancerCount: 0, cueCount: 0, previewDancers: [] };
  }

  const formations = (Array.isArray(o.formations) ? o.formations : [])
    .map(asRecord)
    .filter((f): f is Record<string, unknown> => f != null);
  const cues = (Array.isArray(o.cues) ? o.cues : [])
    .map(asRecord)
    .filter((c): c is Record<string, unknown> => c != null);

  const formation = pickFirstFormation(formations, cues, o.activeFormationId);
  const dancersRaw = Array.isArray(formation?.dancers) ? formation!.dancers : [];

  const previewDancers: ProjectThumbDancer[] = dancersRaw
    .slice(0, 80)
    .map((d, i) => {
      const spot = asRecord(d);
      const colorIndex =
        typeof spot?.colorIndex === "number" && Number.isFinite(spot.colorIndex)
          ? spot.colorIndex
          : i;
      return {
        xPct: Number(spot?.xPct),
        yPct: Number(spot?.yPct),
        colorIndex,
      };
    })
    .filter((d) => Number.isFinite(d.xPct) && Number.isFinite(d.yPct))
    .map((d) => ({
      xPct: d.xPct,
      yPct: d.yPct,
      colorIndex: d.colorIndex,
    }));

  const pieceCount =
    typeof o.pieceDancerCount === "number" && o.pieceDancerCount > 0
      ? Math.floor(o.pieceDancerCount)
      : 0;
  const dancerCount = Math.max(previewDancers.length, pieceCount);

  return {
    dancerCount,
    cueCount: cues.length,
    previewDancers,
  };
}

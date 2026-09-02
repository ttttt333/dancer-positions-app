export type ProjectThumbDancer = {
  xPct: number;
  yPct: number;
  colorIndex: number;
};

/** 作品内の 1 キュー分。ライブラリからそのキューへ飛ぶために使う */
export type ProjectCuePreview = {
  cueId: string;
  ordinal: number;
  name: string;
  tStartSec: number;
  dancers: ProjectThumbDancer[];
};

/** 作品に保存した立ち位置スロット（タイムラインとは別） */
export type ProjectSavedSpotPreview = {
  slotId: string;
  name: string;
  dancers: ProjectThumbDancer[];
};

export type ProjectListSummary = {
  dancerCount: number;
  cueCount: number;
  previewDancers: ProjectThumbDancer[];
  cuePreviews: ProjectCuePreview[];
  savedSpotPreviews: ProjectSavedSpotPreview[];
};

const EMPTY_SUMMARY: ProjectListSummary = {
  dancerCount: 0,
  cueCount: 0,
  previewDancers: [],
  cuePreviews: [],
  savedSpotPreviews: [],
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function thumbDancersFromUnknown(raw: unknown): ProjectThumbDancer[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
  if (!o) return { ...EMPTY_SUMMARY };

  const formations = (Array.isArray(o.formations) ? o.formations : [])
    .map(asRecord)
    .filter((f): f is Record<string, unknown> => f != null);
  const cues = (Array.isArray(o.cues) ? o.cues : [])
    .map(asRecord)
    .filter((c): c is Record<string, unknown> => c != null);
  const formationById = new Map(
    formations
      .map((f) => [typeof f.id === "string" ? f.id : "", f] as const)
      .filter((x) => x[0] !== "")
  );

  const sortedCues = [...cues].sort(
    (a, b) => Number(a.tStartSec ?? 0) - Number(b.tStartSec ?? 0)
  );

  const cuePreviews: ProjectCuePreview[] = sortedCues.flatMap((cue, i) => {
    const cueId = typeof cue.id === "string" ? cue.id : "";
    if (!cueId) return [];
    const fid = typeof cue.formationId === "string" ? cue.formationId : "";
    const formation = fid ? formationById.get(fid) : undefined;
    const name =
      typeof formation?.name === "string" && formation.name.trim()
        ? formation.name.trim()
        : "";
    const tStartSec = Number(cue.tStartSec);
    return [
      {
        cueId,
        ordinal: i + 1,
        name,
        tStartSec: Number.isFinite(tStartSec) ? tStartSec : 0,
        dancers: thumbDancersFromUnknown(formation?.dancers),
      },
    ];
  });

  const savedSpotPreviews: ProjectSavedSpotPreview[] = (
    Array.isArray(o.savedSpotLayouts) ? o.savedSpotLayouts : []
  )
    .map(asRecord)
    .filter((s): s is Record<string, unknown> => s != null)
    .slice(0, 9)
    .flatMap((slot) => {
      const slotId = typeof slot.id === "string" ? slot.id : "";
      if (!slotId) return [];
      const name =
        typeof slot.name === "string" && slot.name.trim()
          ? slot.name.trim()
          : "";
      return [
        {
          slotId,
          name,
          dancers: thumbDancersFromUnknown(slot.dancers),
        },
      ];
    });

  const formation = pickFirstFormation(formations, cues, o.activeFormationId);
  const previewDancers =
    cuePreviews[0]?.dancers ?? thumbDancersFromUnknown(formation?.dancers);

  const pieceCount =
    typeof o.pieceDancerCount === "number" && o.pieceDancerCount > 0
      ? Math.floor(o.pieceDancerCount)
      : 0;

  let maxFormationDancers = 0;
  for (const f of formations) {
    const n = Array.isArray(f.dancers) ? f.dancers.length : 0;
    if (n > maxFormationDancers) maxFormationDancers = n;
  }

  const dancerCount = Math.max(
    previewDancers.length,
    maxFormationDancers,
    pieceCount
  );

  return {
    dancerCount,
    cueCount: cues.length,
    previewDancers,
    cuePreviews,
    savedSpotPreviews,
  };
}

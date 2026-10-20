import type { Cue, DancerSpot, Formation } from "../types/choreography";
import { cueNumberById, sortCuesByStart } from "./cueInterval";
import { classifyMovementCostPct } from "./stageMovementGrade";
import { movementCostPct } from "./stageShapeGenerator";

/** この距離未満（ステージ%）は静止とみなして ○ を出さない */
export const PREV_CUE_COMPARE_MOVE_EPS_PCT = 1.2;

export type PrevCueCompareMark = {
  dancerId: string;
  colorIndex: number;
  fromXPct: number;
  fromYPct: number;
  toXPct: number;
  toYPct: number;
};

/** 選択中 Cue の直前 Cue の dancers。先頭 Cue / 不明なら null。配列は参照のみ。 */
export function resolvePreviousCueDancers(
  cues: Cue[],
  formations: Formation[],
  currentCueId: string | null | undefined
): DancerSpot[] | null {
  if (!currentCueId) return null;
  const sorted = sortCuesByStart(cues);
  const i = sorted.findIndex((c) => c.id === currentCueId);
  if (i <= 0) return null;
  const prev = sorted[i - 1]!;
  const f = formations.find((x) => x.id === prev.formationId);
  return f?.dancers ?? null;
}

/** 直前 Cue の 1 始まり番号。先頭 Cue / 不明なら null。 */
export function resolvePreviousCueOrdinal(
  cues: Cue[],
  currentCueId: string | null | undefined
): number | null {
  const n = cueNumberById(cues, currentCueId);
  if (n == null || n <= 1) return null;
  return n - 1;
}

/** 選択中 Cue の次 Cue の dancers。末尾 / 不明なら null。 */
export function resolveNextCueDancers(
  cues: Cue[],
  formations: Formation[],
  currentCueId: string | null | undefined
): DancerSpot[] | null {
  if (!currentCueId) return null;
  const sorted = sortCuesByStart(cues);
  const i = sorted.findIndex((c) => c.id === currentCueId);
  if (i < 0 || i >= sorted.length - 1) return null;
  const next = sorted[i + 1]!;
  const f = formations.find((x) => x.id === next.formationId);
  return f?.dancers ?? null;
}

/** 次 Cue の 1 始まり番号。末尾 / 不明なら null。 */
export function resolveNextCueOrdinal(
  cues: Cue[],
  currentCueId: string | null | undefined
): number | null {
  const n = cueNumberById(cues, currentCueId);
  if (n == null) return null;
  const sorted = sortCuesByStart(cues);
  if (n >= sorted.length) return null;
  return n + 1;
}

/** 指定 Cue の dancers。無い／空なら null。配列は参照のみ。 */
export function resolveCueDancersById(
  cues: Cue[],
  formations: Formation[],
  cueId: string | null | undefined
): DancerSpot[] | null {
  if (!cueId) return null;
  const cue = cues.find((c) => c.id === cueId);
  if (!cue) return null;
  const f = formations.find((x) => x.id === cue.formationId);
  const dancers = f?.dancers;
  return dancers && dancers.length > 0 ? dancers : null;
}

/**
 * 最短距離並び替え／雛形割当の参照キュー候補。
 * 現在キュー以外で立ち位置があるキューを、前→次→その他の順で返す。
 */
export type TravelMatchCueOption = {
  cueId: string;
  ordinal: number;
  kind: "previous" | "next" | "other";
  label: string;
  dancers: readonly DancerSpot[];
};

export function listTravelMatchCueOptions(
  cues: Cue[],
  formations: Formation[],
  currentCueId: string | null | undefined
): TravelMatchCueOption[] {
  const sorted = sortCuesByStart(cues);
  const curIdx = currentCueId
    ? sorted.findIndex((c) => c.id === currentCueId)
    : -1;
  const out: TravelMatchCueOption[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i]!;
    if (curIdx >= 0 && i === curIdx) continue;
    const dancers = resolveCueDancersById(cues, formations, cue.id);
    if (!dancers?.length) continue;
    const ordinal = i + 1;
    const kind: TravelMatchCueOption["kind"] =
      curIdx >= 0 && i === curIdx - 1
        ? "previous"
        : curIdx >= 0 && i === curIdx + 1
          ? "next"
          : "other";
    const label =
      kind === "previous"
        ? `前のキュー（${ordinal}）`
        : kind === "next"
          ? `次のキュー（${ordinal}）`
          : `キュー ${ordinal}`;
    out.push({ cueId: cue.id, ordinal, kind, label, dancers });
  }
  /** 前・次を先頭に、残りは時刻順のまま */
  return out.sort((a, b) => {
    const rank = (k: TravelMatchCueOption["kind"]) =>
      k === "previous" ? 0 : k === "next" ? 1 : 2;
    const dr = rank(a.kind) - rank(b.kind);
    if (dr !== 0) return dr;
    return a.ordinal - b.ordinal;
  });
}

/** 候補から既定の参照キュー（前 → 次 → 先頭）を選ぶ */
export function defaultTravelMatchCueId(
  options: readonly TravelMatchCueOption[]
): string | null {
  if (options.length === 0) return null;
  return (
    options.find((o) => o.kind === "previous")?.cueId ??
    options.find((o) => o.kind === "next")?.cueId ??
    options[0]!.cueId
  );
}

/**
 * 再生位置に新規キューを挿すとき用。
 * 直前キューを「前」、直後キューを「次」として候補を返す。
 */
export function listTravelMatchCueOptionsForInsert(
  cues: Cue[],
  formations: Formation[],
  playheadSec: number
): TravelMatchCueOption[] {
  const sorted = sortCuesByStart(cues);
  let prevIdx = -1;
  let nextIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    if (c.tEndSec <= playheadSec + 1e-6) prevIdx = i;
    if (nextIdx < 0 && c.tStartSec >= playheadSec - 1e-6) nextIdx = i;
  }
  const out: TravelMatchCueOption[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i]!;
    const dancers = resolveCueDancersById(cues, formations, cue.id);
    if (!dancers?.length) continue;
    const ordinal = i + 1;
    const kind: TravelMatchCueOption["kind"] =
      i === prevIdx ? "previous" : i === nextIdx ? "next" : "other";
    const label =
      kind === "previous"
        ? `前のキュー（${ordinal}）`
        : kind === "next"
          ? `次のキュー（${ordinal}）`
          : `キュー ${ordinal}`;
    out.push({ cueId: cue.id, ordinal, kind, label, dancers });
  }
  return out.sort((a, b) => {
    const rank = (k: TravelMatchCueOption["kind"]) =>
      k === "previous" ? 0 : k === "next" ? 1 : 2;
    const dr = rank(a.kind) - rank(b.kind);
    if (dr !== 0) return dr;
    return a.ordinal - b.ordinal;
  });
}

/**
 * 前 Cue と現 Cue を dancer id で対応付ける。
 * dancers[] の順番は見ない。入力配列は変更しない。
 */
export function buildPrevCueCompareMarks(opts: {
  prevDancers: readonly DancerSpot[];
  currentDancers: readonly DancerSpot[];
  moveEpsPct?: number;
}): PrevCueCompareMark[] {
  const eps = opts.moveEpsPct ?? PREV_CUE_COMPARE_MOVE_EPS_PCT;
  const currentById = new Map(opts.currentDancers.map((d) => [d.id, d] as const));
  const marks: PrevCueCompareMark[] = [];
  for (const prev of opts.prevDancers) {
    const cur = currentById.get(prev.id);
    if (!cur) continue;
    const dist = movementCostPct(
      { xPct: prev.xPct, yPct: prev.yPct },
      { xPct: cur.xPct, yPct: cur.yPct }
    );
    if (dist < eps) continue;
    marks.push({
      dancerId: prev.id,
      colorIndex: cur.colorIndex,
      fromXPct: prev.xPct,
      fromYPct: prev.yPct,
      toXPct: cur.xPct,
      toYPct: cur.yPct,
    });
  }
  return marks;
}

export type PrevCueCompareSummary = {
  matchedCount: number;
  movedCount: number;
  stillCount: number;
  smallCount: number;
  mediumCount: number;
  largeCount: number;
  maxMovePct: number;
};

/**
 * 前 Cue との差分サマリー。座標は既存 movementCostPct。
 * 小/中/大 は classifyMovementCostPct（表示用・将来変更可）。
 */
export function summarizePrevCueCompare(opts: {
  prevDancers: readonly DancerSpot[];
  currentDancers: readonly DancerSpot[];
  moveEpsPct?: number;
}): PrevCueCompareSummary {
  const eps = opts.moveEpsPct ?? PREV_CUE_COMPARE_MOVE_EPS_PCT;
  const currentById = new Map(
    opts.currentDancers.map((d) => [d.id, d] as const)
  );
  let matchedCount = 0;
  let movedCount = 0;
  let stillCount = 0;
  let smallCount = 0;
  let mediumCount = 0;
  let largeCount = 0;
  let maxMovePct = 0;
  for (const prev of opts.prevDancers) {
    const cur = currentById.get(prev.id);
    if (!cur) continue;
    matchedCount += 1;
    const cost = movementCostPct(
      { xPct: prev.xPct, yPct: prev.yPct },
      { xPct: cur.xPct, yPct: cur.yPct }
    );
    if (cost < eps) {
      stillCount += 1;
      continue;
    }
    movedCount += 1;
    if (cost > maxMovePct) maxMovePct = cost;
    const grade = classifyMovementCostPct(cost);
    if (grade === "小") smallCount += 1;
    else if (grade === "中") mediumCount += 1;
    else largeCount += 1;
  }
  return {
    matchedCount,
    movedCount,
    stillCount,
    smallCount,
    mediumCount,
    largeCount,
    maxMovePct,
  };
}

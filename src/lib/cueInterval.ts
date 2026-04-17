import type { Cue, Formation, SetPiece } from "../types/choreography";

export function sortCuesByStart(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.tStartSec - b.tStartSec || a.tEndSec - b.tEndSec);
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

type RawCue = Record<string, unknown> & {
  id?: unknown;
  formationId?: unknown;
  timeSec?: unknown;
  tStartSec?: unknown;
  tEndSec?: unknown;
  name?: unknown;
  note?: unknown;
};

/**
 * 旧 timeSec キュー → ChoreoGrid 区間キュー（tStart / tEnd）。
 */
export function migrateCuesFromRaw(
  cuesRaw: unknown[],
  formations: Formation[]
): Cue[] {
  if (!Array.isArray(cuesRaw) || cuesRaw.length === 0) return [];
  const defaultFid = formations[0]?.id ?? "";

  const rows: {
    id: string;
    formationId: string;
    tStart: number;
    tEnd: number | null;
    name?: string;
    note?: string;
  }[] = [];

  for (const raw of cuesRaw) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as RawCue;
    const fidRaw = c.formationId;
    const formationId =
      typeof fidRaw === "string" && formations.some((f) => f.id === fidRaw)
        ? fidRaw
        : defaultFid;
    const id =
      typeof c.id === "string" && c.id ? c.id : randomId("cue");
    const name =
      typeof c.name === "string" ? c.name.trim().slice(0, 80) || undefined : undefined;
    const note = typeof c.note === "string" ? c.note : undefined;

    const tsKnown =
      typeof c.tStartSec === "number" && Number.isFinite(c.tStartSec)
        ? c.tStartSec
        : typeof c.timeSec === "number" && Number.isFinite(c.timeSec)
          ? c.timeSec
          : 0;
    const teKnown =
      typeof c.tEndSec === "number" && Number.isFinite(c.tEndSec)
        ? c.tEndSec
        : null;

    rows.push({
      id,
      formationId,
      tStart: Math.max(0, Math.round(tsKnown * 100) / 100),
      tEnd:
        teKnown != null && teKnown > tsKnown
          ? Math.round(teKnown * 100) / 100
          : null,
      name,
      note,
    });
  }

  rows.sort((a, b) => a.tStart - b.tStart);

  const out: Cue[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const next = rows[i + 1];
    let tEnd = row.tEnd;
    if (tEnd == null || tEnd <= row.tStart) {
      if (next) {
        tEnd = Math.max(row.tStart + 0.01, next.tStart - 0.01);
      } else {
        tEnd = row.tStart + 3;
      }
    }
    if (tEnd <= row.tStart) tEnd = row.tStart + 0.01;
    out.push({
      id: row.id,
      tStartSec: row.tStart,
      tEndSec: Math.round(tEnd * 100) / 100,
      formationId: row.formationId,
      name: row.name,
      note: row.note,
    });
  }
  return sortCuesByStart(out);
}

export function cloneFormationForNewCue(f: Formation): Formation {
  const pieces: SetPiece[] = (f.setPieces ?? []).map((p) => ({
    ...p,
    id: crypto.randomUUID(),
  }));
  return {
    ...f,
    id: crypto.randomUUID(),
    name:
      f.name.trim().length > 0
        ? `${f.name.trim().slice(0, 60)} · コピー`
        : "フォーメーション",
    dancers: f.dancers.map((d) => ({ ...d })),
    setPieces: pieces,
  };
}

/** タイムライン上の区間の最短長（秒）。ドラッグ・入力と揃える */
export const MIN_CUE_DURATION_SEC = 0.05;

type FreeSeg = { a: number; b: number };

function buildFreeSegments(
  others: Cue[],
  trimLo: number,
  trimHi: number
): FreeSeg[] {
  const sorted = sortCuesByStart(others);
  const segs: FreeSeg[] = [];
  let cursor = trimLo;
  for (const o of sorted) {
    const os = Math.round(o.tStartSec * 100) / 100;
    const oe = Math.round(o.tEndSec * 100) / 100;
    if (os > cursor + 1e-6) {
      segs.push({ a: cursor, b: os });
    }
    cursor = Math.max(cursor, oe);
  }
  if (trimHi > cursor + 1e-6) {
    segs.push({ a: cursor, b: trimHi });
  }
  return segs;
}

function pickGapForInterval(
  segs: FreeSeg[],
  ns: number,
  ne: number,
  trimLo: number,
  trimHi: number
): FreeSeg {
  if (segs.length === 0) {
    return { a: trimLo, b: trimHi };
  }
  const mid = (ns + ne) / 2;
  for (const s of segs) {
    if (mid >= s.a - 1e-9 && mid <= s.b + 1e-9) return s;
  }
  let best = segs[0];
  let bestScore = -1;
  for (const s of segs) {
    const is = Math.max(ns, s.a);
    const ie = Math.min(ne, s.b);
    const score = ie - is;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = s;
    }
  }
  if (bestScore > 1e-9) return best;
  return segs.reduce((w, s) => (s.b - s.a > w.b - w.a ? s : w));
}

function fitIntervalInGap(
  gapA: number,
  gapB: number,
  ns: number,
  ne: number,
  minD: number
): { tStartSec: number; tEndSec: number } {
  const gapW = Math.round((gapB - gapA) * 100) / 100;
  if (gapW <= 0) {
    return { tStartSec: gapA, tEndSec: gapB };
  }
  const minDur = Math.round(minD * 100) / 100;
  let dur = Math.round((ne - ns) * 100) / 100;
  dur = Math.max(minDur, dur);
  dur = Math.min(dur, gapW);

  const mid = (ns + ne) / 2;
  let s = Math.round((mid - dur / 2) * 100) / 100;
  let e = Math.round((s + dur) * 100) / 100;

  if (s < gapA) {
    e += gapA - s;
    s = gapA;
  }
  if (e > gapB) {
    s -= e - gapB;
    e = gapB;
  }
  if (s < gapA) s = gapA;
  if (e > gapB) e = gapB;

  if (e - s < minDur - 1e-9 && gapW >= minDur - 1e-9) {
    s = gapA;
    e = Math.min(gapB, gapA + minDur);
  }
  return {
    tStartSec: Math.round(s * 100) / 100,
    tEndSec: Math.round(e * 100) / 100,
  };
}

/**
 * 他キューと時間が重ならないよう、指定 id の区間 [desiredStart, desiredEnd] をトリム内の空きに収める。
 * 編集中キューは others から除く（ドラッグ中は元位置が邪魔にならない）。
 */
export function resolveCueIntervalNonOverlap(
  cues: Cue[],
  cueId: string,
  desiredStart: number,
  desiredEnd: number,
  trimLo: number,
  trimHi: number
): { tStartSec: number; tEndSec: number } {
  const tLo = Math.min(trimLo, trimHi);
  const tHi = Math.max(trimLo, trimHi);
  let ns = Math.round(desiredStart * 100) / 100;
  let ne = Math.round(desiredEnd * 100) / 100;
  if (!Number.isFinite(ns) || !Number.isFinite(ne)) {
    return {
      tStartSec: Math.round(tLo * 100) / 100,
      tEndSec: Math.round(Math.min(tHi, tLo + MIN_CUE_DURATION_SEC) * 100) / 100,
    };
  }
  if (ne <= ns) {
    ne = Math.round((ns + MIN_CUE_DURATION_SEC) * 100) / 100;
  }

  const others = cues.filter((c) => c.id !== cueId);
  const segs = buildFreeSegments(others, tLo, tHi);
  let viable = segs.filter(
    (s) => s.b - s.a >= MIN_CUE_DURATION_SEC - 1e-9
  );
  if (viable.length === 0 && segs.length > 0) {
    viable = segs;
  }
  if (viable.length === 0) {
    return {
      tStartSec: Math.round(tLo * 100) / 100,
      tEndSec: Math.round(Math.min(tHi, tLo + MIN_CUE_DURATION_SEC) * 100) / 100,
    };
  }

  const gap = pickGapForInterval(viable, ns, ne, tLo, tHi);
  return fitIntervalInGap(gap.a, gap.b, ns, ne, MIN_CUE_DURATION_SEC);
}

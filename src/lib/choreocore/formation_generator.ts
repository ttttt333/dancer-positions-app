/**
 * 変化点 → 現実的隊列選定
 * - 4エイト（32カウント）固定の可動域
 * - eight_index 0,4,8,... に同期
 * - CHORUS_START はインパクト隊列を最優先
 */

import {
  assignPerformersOrdered,
  maxTravelMeters,
  totalTravelMeters,
} from "./assignment";
import {
  buildRealisticLayouts,
  type LayoutKind,
  type RealisticLayout,
} from "./layouts_realistic";
import type {
  ChangePoint,
  ChangeTier,
  Formation,
  GenerateFormationsResult,
  GeneratedCue,
  SectionType,
} from "./types";
import {
  COUNTS_PER_FOUR_EIGHT_BLOCK,
  EIGHTS_PER_BLOCK,
  METERS_PER_COUNT,
} from "./types";

export type SongSectionHint = {
  label: string;
  startSec: number;
  endSec: number;
  avgEnergy: number;
};

export type EnergyMood = "quiet" | "verse" | "lift" | "chorus" | "break";

function genId(): string {
  return (
    crypto.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 互換: 時間差からのカウント（非推奨・テスト用） */
export function availableCountsBetween(
  fromSec: number,
  toSec: number,
  bpm: number
): number {
  const dt = Math.max(0, toSec - fromSec);
  const beats = dt * (Math.max(1, bpm) / 60);
  return Math.max(4, Math.floor(beats * 2));
}

/** 4エイトブロック固定（32カウント） */
export function availableCountsForFourEightBlock(): number {
  return COUNTS_PER_FOUR_EIGHT_BLOCK;
}

export function computeMaxFeasibleDistance(availableCounts: number): number {
  return Math.min(
    5.5,
    Math.max(0.8, availableCounts * METERS_PER_COUNT)
  );
}

export function resolveSectionType(cp: ChangePoint): SectionType {
  if (cp.section_type) return cp.section_type;
  if (cp.tier === "major" && cp.score >= 0.55) return "CHORUS_START";
  if (cp.tier === "major") return "CHORUS";
  return "VERSE";
}

/** eight_index を 4 の倍数に揃える */
export function snapEightIndexToBlock(eightIndex: number): number {
  return Math.max(0, Math.floor(eightIndex / EIGHTS_PER_BLOCK) * EIGHTS_PER_BLOCK);
}

export function sectionAt(
  timeSec: number,
  sections: SongSectionHint[] | undefined
): SongSectionHint | null {
  if (!sections?.length) return null;
  for (const s of sections) {
    if (timeSec >= s.startSec - 0.05 && timeSec < s.endSec + 0.05) return s;
  }
  const last = sections[sections.length - 1]!;
  if (timeSec >= last.startSec) return last;
  return sections[0] ?? null;
}

export function moodFromSection(
  section: SongSectionHint | null,
  changeScore: number,
  timeSec: number,
  durationSec: number,
  sectionType?: SectionType
): EnergyMood {
  if (sectionType === "CHORUS_START" || sectionType === "CHORUS") {
    return "chorus";
  }
  const energy = section?.avgEnergy ?? changeScore;
  const label = section?.label ?? "";
  const p = timeSec / Math.max(1, durationSec);

  if (/サビ/.test(label) || energy >= 0.65) return "chorus";
  if (/間奏|ブレイク/.test(label) || (energy < 0.28 && p > 0.15 && p < 0.85)) {
    return "break";
  }
  if (/イントロ/.test(label) || (p < 0.12 && energy < 0.5)) return "quiet";
  if (/アウトロ/.test(label) || p > 0.88) return "quiet";
  if (/Bメロ|ブリッジ/.test(label) || (energy >= 0.45 && energy < 0.65)) {
    return "lift";
  }
  if (changeScore >= 0.45) return "lift";
  return "verse";
}

function sectionTypeJa(st: SectionType): string {
  if (st === "CHORUS_START") return "サビ頭";
  if (st === "CHORUS") return "サビ";
  return "平歌";
}

function pickLayout(opts: {
  layouts: RealisticLayout[];
  mood: EnergyMood;
  sectionType: SectionType;
  prev: Formation;
  availableCounts: number;
  recentKinds: LayoutKind[];
  recentIds: string[];
  salt: number;
}): { layout: RealisticLayout; formation: Formation } {
  const maxDist = computeMaxFeasibleDistance(opts.availableCounts);
  const recentKind = new Set(opts.recentKinds.slice(-3));
  const recentId = new Set(opts.recentIds.slice(-4));

  let pool: RealisticLayout[];
  if (opts.sectionType === "CHORUS_START") {
    // 大V字・扇形・クロス等のインパクトを最優先
    const impact = opts.layouts.filter((l) => l.impact);
    pool = impact.length >= 2 ? impact : opts.layouts.filter((l) =>
      l.moods.includes("chorus")
    );
  } else if (opts.sectionType === "CHORUS") {
    const chorus = opts.layouts.filter((l) => l.moods.includes("chorus"));
    pool = chorus.length >= 2 ? chorus : opts.layouts;
  } else {
    const moodPool = opts.layouts.filter((l) => l.moods.includes(opts.mood));
    pool = moodPool.length >= 3 ? moodPool : opts.layouts;
  }

  type Cand = {
    layout: RealisticLayout;
    formation: Formation;
    total: number;
    max: number;
    score: number;
  };

  const evaluated: Cand[] = pool.map((layout, idx) => {
    const formation = assignPerformersOrdered(opts.prev, layout.positions);
    const total = totalTravelMeters(opts.prev, formation);
    const max = maxTravelMeters(opts.prev, formation);
    const kindPenalty = recentKind.has(layout.kind) ? 1.4 : 0;
    const idPenalty = recentId.has(layout.id) ? 2.0 : 0;
    const impactBonus =
      opts.sectionType === "CHORUS_START" && layout.impact ? 2.5 : 0;
    // サビ頭は大きめ移動を許容・推奨、平歌は中庸
    const targetRatio = opts.sectionType === "CHORUS_START" ? 0.72 : 0.48;
    const target = maxDist * targetRatio;
    const per = Math.max(1, opts.prev.performers.length);
    const travelFit = -Math.abs(total / per - target / per);
    const jitter = ((idx * 19 + opts.salt * 7) % 11) * 0.02;
    const score =
      travelFit * 3 - kindPenalty - idPenalty + impactBonus + jitter;
    return { layout, formation, total, max, score };
  });

  const feasible = evaluated.filter((c) => c.max <= maxDist + 0.2);
  const pickFrom = feasible.length > 0 ? feasible : evaluated;
  const ranked = [...pickFrom].sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const chosen = top[opts.salt % top.length] ?? ranked[0]!;
  return { layout: chosen.layout, formation: chosen.formation };
}

export type GenerateFormationsOptions = {
  durationSec?: number;
  songDynamism?: number;
  sections?: SongSectionHint[];
  energyCurve?: number[];
};

/**
 * 変化点に沿って現実的なフォーメーション列を生成する。
 * 切り替えは 4エイト先頭に同期し、可動域は 32カウント固定。
 */
export function generateFormations(
  changePoints: ChangePoint[],
  initialFormation: Formation,
  bpm: number,
  opts: GenerateFormationsOptions = {}
): GenerateFormationsResult {
  const durationSec =
    opts.durationSec ??
    Math.max(60, ...(changePoints.map((c) => c.time + 16)));

  // eight_index を 4 の倍数に揃え、近い重複を除去
  const points = [...changePoints]
    .map((cp) => ({
      ...cp,
      eight_index: snapEightIndexToBlock(cp.eight_index),
    }))
    .sort((a, b) => a.time - b.time || a.eight_index - b.eight_index)
    .filter((cp, i, arr) => {
      if (cp.eight_index === 0) return false;
      if (i === 0) return true;
      return cp.eight_index !== arr[i - 1]!.eight_index;
    });

  const dancerCount = Math.max(1, initialFormation.performers.length);
  const layouts = buildRealisticLayouts(dancerCount);
  const counts = availableCountsForFourEightBlock();

  const formations: Formation[] = [];
  const cues: GeneratedCue[] = [];
  const reasoning: string[] = [];

  let prev: Formation = {
    id: initialFormation.id || genId(),
    performers: initialFormation.performers.map((p) => ({
      id: p.id,
      position: { ...p.position },
    })),
  };
  const recentKinds: LayoutKind[] = [];
  const recentIds: string[] = [];

  const startFm: Formation = { ...prev, id: genId() };
  formations.push(startFm);
  const firstT = points[0]?.time ?? durationSec;
  const introEnd = Math.max(4, Math.min(firstT - 0.5, durationSec));
  cues.push({
    id: genId(),
    formationId: startFm.id,
    tStartSec: 0,
    tEndSec: introEnd,
    name: "開始",
    tier: "minor",
  });
  reasoning.push(
    `開始（${dancerCount}人 / 4エイト=32カウント固定 / BPM ${Math.round(bpm)}）`
  );

  for (let i = 0; i < points.length; i++) {
    const cp = points[i]!;
    const nextT = points[i + 1]?.time ?? durationSec;
    const stype = resolveSectionType(cp);
    const section = sectionAt(cp.time, opts.sections);
    const mood = moodFromSection(
      section,
      cp.score,
      cp.time,
      durationSec,
      stype
    );

    const picked = pickLayout({
      layouts,
      mood,
      sectionType: stype,
      prev,
      availableCounts: counts,
      recentKinds,
      recentIds,
      salt: i + cp.eight_index,
    });

    const fm: Formation = { ...picked.formation, id: genId() };
    formations.push(fm);

    const tStart = cp.time;
    const tEnd = Math.max(tStart + 2, nextT - 0.25);
    const name = `${sectionTypeJa(stype)} ${picked.layout.name}`;

    cues.push({
      id: genId(),
      formationId: fm.id,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, durationSec) * 100) / 100,
      name,
      tier: cp.tier,
    });

    reasoning.push(
      `${formatClock(cp.time)} 8×${cp.eight_index} ${sectionTypeJa(stype)} → ${picked.layout.name}（32カウント可動）`
    );

    prev = fm;
    recentKinds.push(picked.layout.kind);
    recentIds.push(picked.layout.id);
    if (recentKinds.length > 6) recentKinds.shift();
    if (recentIds.length > 6) recentIds.shift();
  }

  cues.sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < cues.length - 1; i++) {
    const cur = cues[i]!;
    const nxt = cues[i + 1]!;
    if (cur.tEndSec > nxt.tStartSec) {
      cur.tEndSec = Math.max(cur.tStartSec + 0.5, nxt.tStartSec);
    }
  }

  return { formations, cues, reasoning };
}

/** 互換: 旧 API */
export function pickFormationPushingLimit(
  pool: { id: string; name: string; positions: { x: number; y: number }[] }[],
  prev: Formation,
  availableCounts: number,
  _avoidTemplateId?: string | null
): { template: (typeof pool)[number]; formation: Formation } {
  const maxDist = computeMaxFeasibleDistance(availableCounts);
  let best = pool[0]!;
  let bestFm = assignPerformersOrdered(prev, best.positions);
  let bestScore = -Infinity;
  for (const t of pool) {
    const fm = assignPerformersOrdered(prev, t.positions);
    const max = maxTravelMeters(prev, fm);
    const total = totalTravelMeters(prev, fm);
    if (max > maxDist + 0.2) continue;
    const target = maxDist * 0.5;
    const score = -Math.abs(total - target);
    if (score > bestScore) {
      bestScore = score;
      best = t;
      bestFm = fm;
    }
  }
  return { template: best, formation: bestFm };
}

export function songPhaseAt(
  timeSec: number,
  durationSec: number
): "intro" | "build" | "peak" | "outro" {
  const p = timeSec / Math.max(1, durationSec);
  if (p < 0.12) return "intro";
  if (p < 0.38) return "build";
  if (p < 0.78) return "peak";
  return "outro";
}

export type { ChangeTier };

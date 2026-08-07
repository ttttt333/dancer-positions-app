/**
 * 変化点 → 現実的隊列選定
 * - 4エイト（32カウント）固定の可動域
 * - eight_index 0,4,8,... に同期
 * - CHORUS_START はインパクト隊列を最優先
 * - Tier1 v6.1: MOVE/SAFETY スコアで決定的に選定
 */

import {
  buildRealisticLayouts,
  type RealisticLayout,
} from "./layouts_realistic";
import {
  computePersonalMaxDist,
  explainFormationScore,
  pickBestScoredFormation,
  pickResultToFormation,
  type FormationScore,
  type FormationTemplate,
  type SuggestFeedback,
  type Tier as Tier1Tier,
} from "./tier1";
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

function toCoreFormation(
  f: { id?: string; performers: Formation["performers"] },
  id: string
): Formation {
  return {
    id,
    performers: f.performers.map((p) => ({
      id: p.id,
      position: { ...p.position },
    })),
  };
}
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
  return Math.max(
    0,
    Math.floor(eightIndex / EIGHTS_PER_BLOCK) * EIGHTS_PER_BLOCK
  );
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

function tierForSection(st: SectionType): Tier1Tier {
  if (st === "CHORUS_START" || st === "CHORUS") return "major";
  return "medium";
}

function layoutToTemplate(
  layout: RealisticLayout,
  tier: Tier1Tier
): FormationTemplate {
  const tags: string[] = [...layout.moods];
  if (layout.impact) tags.push("impact");
  return {
    id: layout.id,
    name: layout.name,
    tier,
    tags,
    slots: layout.positions.map((p, i) => ({
      id: `${layout.id}_s${String(i).padStart(2, "0")}`,
      position: { x: p.x, y: p.y },
    })),
  };
}

function buildPool(
  layouts: RealisticLayout[],
  sectionType: SectionType,
  mood: EnergyMood
): { primary: FormationTemplate[]; fallback: FormationTemplate[] } {
  const tier = tierForSection(sectionType);
  const all = layouts.map((l) => layoutToTemplate(l, tier));
  let primaryLayouts: RealisticLayout[];
  if (sectionType === "CHORUS_START") {
    const impact = layouts.filter((l) => l.impact);
    primaryLayouts =
      impact.length >= 2
        ? impact
        : layouts.filter((l) => l.moods.includes("chorus"));
  } else if (sectionType === "CHORUS") {
    const chorus = layouts.filter((l) => l.moods.includes("chorus"));
    primaryLayouts = chorus.length >= 2 ? chorus : layouts;
  } else {
    const moodPool = layouts.filter((l) => l.moods.includes(mood));
    primaryLayouts = moodPool.length >= 3 ? moodPool : layouts;
  }
  return {
    primary: primaryLayouts.map((l) => layoutToTemplate(l, tier)),
    fallback: all,
  };
}

export type GenerateFormationsOptions = {
  durationSec?: number;
  songDynamism?: number;
  sections?: SongSectionHint[];
  energyCurve?: number[];
  feedback?: SuggestFeedback;
};

export type GenerateFormationsResultEx = GenerateFormationsResult & {
  scores: FormationScore[];
};

/**
 * 変化点に沿って現実的なフォーメーション列を生成する。
 */
export function generateFormations(
  changePoints: ChangePoint[],
  initialFormation: Formation,
  bpm: number,
  opts: GenerateFormationsOptions = {}
): GenerateFormationsResultEx {
  const durationSec =
    opts.durationSec ??
    Math.max(60, ...(changePoints.map((c) => c.time + 16)));
  const dynamism = opts.songDynamism ?? 0.5;

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
  const maxDist = computePersonalMaxDist(counts, bpm, dynamism);

  const formations: Formation[] = [];
  const cues: GeneratedCue[] = [];
  const reasoning: string[] = [];
  const scores: FormationScore[] = [];

  let prev: Formation = {
    id: initialFormation.id || genId(),
    performers: initialFormation.performers.map((p) => ({
      id: p.id,
      position: { ...p.position },
    })),
  };
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
    `開始（${dancerCount}人 / 4エイト=32カウント / maxDist ${maxDist.toFixed(2)}m / BPM ${Math.round(bpm)}）`
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

    const feedback: SuggestFeedback = {
      ...opts.feedback,
      preferMoreImpact:
        Boolean(opts.feedback?.preferMoreImpact) || stype === "CHORUS_START",
      avoidLayoutIds: [
        ...(opts.feedback?.avoidLayoutIds ?? []),
        ...recentIds.slice(-3),
      ],
    };

    const { primary, fallback } = buildPool(layouts, stype, mood);
    const pick = pickBestScoredFormation(prev, primary, {
      maxFeasibleDistance: maxDist,
      feedback,
      fallbackPool: fallback,
    });

    let fm: Formation;
    let layoutName: string;
    let scoreLine = "";
    if (pick) {
      fm = toCoreFormation(pickResultToFormation(prev, pick), genId());
      layoutName = pick.formation.name ?? pick.formation.id;
      scores.push(pick.score);
      scoreLine = ` / スコア${pick.score.total}(移動${pick.score.axes.move}/安全${pick.score.axes.safety}) 交差${pick.crossings.length}`;
      if (pick.crossings.length > 0) {
        const c0 = pick.crossings[0]!;
        scoreLine += ` 例:${c0.performerAId}×${c0.performerBId}`;
      }
      recentIds.push(pick.formation.id);
    } else {
      fm = { ...prev, id: genId() };
      layoutName = "現状維持";
      scores.push({
        total: 0,
        axes: { move: 0, safety: 0, visual: null, music: null },
        weights: { move: 0.6, safety: 0.4, visual: 0, music: 0 },
      });
    }

    formations.push(fm);

    const tStart = cp.time;
    const tEnd = Math.max(tStart + 2, nextT - 0.25);
    const name = `${sectionTypeJa(stype)} ${layoutName}`;

    cues.push({
      id: genId(),
      formationId: fm.id!,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, durationSec) * 100) / 100,
      name,
      tier: cp.tier,
    });

    reasoning.push(
      `${formatClock(cp.time)} 8×${cp.eight_index} ${sectionTypeJa(stype)} → ${layoutName}${scoreLine}`
    );

    prev = fm;
    if (recentIds.length > 6) recentIds.shift();
  }

  if (scores.length > 0) {
    const avg =
      scores.reduce((s, x) => s + x.total, 0) / Math.max(1, scores.length);
    reasoning.unshift(
      `Tier1評価 平均 ${Math.round(avg)}/100（MOVE+SAFETY）`,
      ...explainFormationScore(scores[scores.length - 1]!)
    );
  }

  cues.sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < cues.length - 1; i++) {
    const cur = cues[i]!;
    const nxt = cues[i + 1]!;
    if (cur.tEndSec > nxt.tStartSec) {
      cur.tEndSec = Math.max(cur.tStartSec + 0.5, nxt.tStartSec);
    }
  }

  return { formations, cues, reasoning, scores };
}

/** 互換: 旧 API */
export function pickFormationPushingLimit(
  pool: { id: string; name: string; positions: { x: number; y: number }[] }[],
  prev: Formation,
  availableCounts: number,
  _avoidTemplateId?: string | null
): { template: (typeof pool)[number]; formation: Formation } {
  const templates: FormationTemplate[] = pool.map((t) => ({
    id: t.id,
    name: t.name,
    tier: "medium" as const,
    slots: t.positions.map((p, i) => ({
      id: `${t.id}_${i}`,
      position: { ...p },
    })),
  }));
  const maxDist = computeMaxFeasibleDistance(availableCounts);
  const pick = pickBestScoredFormation(prev, templates, {
    maxFeasibleDistance: maxDist,
  });
  if (!pick) {
    return {
      template: pool[0]!,
      formation: prev,
    };
  }
  const template = pool.find((p) => p.id === pick.formation.id) ?? pool[0]!;
  return {
    template,
    formation: toCoreFormation(pickResultToFormation(prev, pick), genId()),
  };
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

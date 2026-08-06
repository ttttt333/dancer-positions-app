/**
 * 変化点 → 現実的隊列選定
 * - 人数ちょうどレイアウト
 * - 左右順を保つ割り当て
 * - セクション／エネルギーに連動
 * - 「最大移動」ではなく実現可能な中くらいの変化を優先
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
} from "./types";
import { METERS_PER_COUNT } from "./types";

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

export function availableCountsBetween(
  fromSec: number,
  toSec: number,
  bpm: number
): number {
  const dt = Math.max(0, toSec - fromSec);
  const beats = dt * (Math.max(1, bpm) / 60);
  return Math.max(4, Math.floor(beats * 2));
}

export function computeMaxFeasibleDistance(availableCounts: number): number {
  // 現実寄り: 1カウントあたり少し抑えめ + 上限
  return Math.min(4.5, Math.max(0.7, availableCounts * METERS_PER_COUNT * 0.85));
}

export function sectionAt(
  timeSec: number,
  sections: SongSectionHint[] | undefined
): SongSectionHint | null {
  if (!sections?.length) return null;
  for (const s of sections) {
    if (timeSec >= s.startSec - 0.05 && timeSec < s.endSec + 0.05) return s;
  }
  // 最後の終端
  const last = sections[sections.length - 1]!;
  if (timeSec >= last.startSec) return last;
  return sections[0] ?? null;
}

export function moodFromSection(
  section: SongSectionHint | null,
  changeScore: number,
  timeSec: number,
  durationSec: number
): EnergyMood {
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
  if (changeScore >= 0.7 && energy >= 0.5) return "chorus";
  if (changeScore >= 0.45) return "lift";
  return "verse";
}

function moodJa(m: EnergyMood): string {
  if (m === "chorus") return "サビ";
  if (m === "lift") return "盛り上げ";
  if (m === "break") return "ブレイク";
  if (m === "quiet") return "静";
  return "メロ";
}

function energyAt(
  timeSec: number,
  durationSec: number,
  curve: number[] | undefined
): number {
  if (!curve?.length || durationSec <= 0) return 0.5;
  const idx = Math.min(
    curve.length - 1,
    Math.max(0, Math.round((timeSec / durationSec) * (curve.length - 1)))
  );
  const v = curve[idx]!;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}

/**
 * 変化点時刻を近いセクション境界へスナップ（音楽の切れ目に合わせる）
 */
export function snapTimeToSectionBoundary(
  timeSec: number,
  sections: SongSectionHint[] | undefined,
  windowSec = 2.4
): number {
  if (!sections?.length) return timeSec;
  let best = timeSec;
  let bestDist = windowSec;
  for (const s of sections) {
    for (const edge of [s.startSec, s.endSec]) {
      const d = Math.abs(edge - timeSec);
      if (d < bestDist) {
        bestDist = d;
        best = edge;
      }
    }
  }
  return Math.max(0, best);
}

function pickLayout(opts: {
  layouts: RealisticLayout[];
  mood: EnergyMood;
  prev: Formation;
  availableCounts: number;
  recentKinds: LayoutKind[];
  recentIds: string[];
  salt: number;
}): { layout: RealisticLayout; formation: Formation } {
  const maxDist = computeMaxFeasibleDistance(opts.availableCounts);
  const recentKind = new Set(opts.recentKinds.slice(-3));
  const recentId = new Set(opts.recentIds.slice(-4));

  const moodPool = opts.layouts.filter((l) => l.moods.includes(opts.mood));
  const pool = moodPool.length >= 3 ? moodPool : opts.layouts;

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
    // 目標: 上限の 35〜70% くらい動く（小さすぎ／飛びすぎを避ける）
    const target = maxDist * 0.5;
    const travelFit = -Math.abs(total / Math.max(1, opts.prev.performers.length) - target / Math.max(1, opts.prev.performers.length));
    const jitter = ((idx * 19 + opts.salt * 7) % 11) * 0.02;
    const score = travelFit * 3 - kindPenalty - idPenalty + jitter;
    return { layout, formation, total, max, score };
  });

  const feasible = evaluated.filter((c) => c.max <= maxDist + 0.15);
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
  const points = [...changePoints]
    .map((cp) => ({
      ...cp,
      time: snapTimeToSectionBoundary(cp.time, opts.sections),
    }))
    .sort((a, b) => a.time - b.time)
    // スナップ後の近接をマージ
    .filter((cp, i, arr) => {
      if (i === 0) return true;
      return cp.time - arr[i - 1]!.time >= 3.5;
    });

  const dancerCount = Math.max(1, initialFormation.performers.length);
  const layouts = buildRealisticLayouts(dancerCount);

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
  const introEnd = Math.max(4, Math.min(firstT - 1.5, durationSec));
  cues.push({
    id: genId(),
    formationId: startFm.id,
    tStartSec: 0,
    tEndSec: introEnd,
    name: "開始",
    tier: "minor",
  });
  reasoning.push(
    `開始（${dancerCount}人・現実レイアウト ${layouts.length}種 / BPM ${Math.round(bpm)}）`
  );

  for (let i = 0; i < points.length; i++) {
    const cp = points[i]!;
    const nextT = points[i + 1]?.time ?? durationSec;
    const counts = availableCountsBetween(cp.time, nextT, bpm);
    const section = sectionAt(cp.time, opts.sections);
    const localEnergy = energyAt(cp.time, durationSec, opts.energyCurve);
    const mood = moodFromSection(
      section
        ? { ...section, avgEnergy: (section.avgEnergy + localEnergy) / 2 }
        : {
            label: "",
            startSec: cp.time,
            endSec: nextT,
            avgEnergy: localEnergy,
          },
      cp.score,
      cp.time,
      durationSec
    );

    const picked = pickLayout({
      layouts,
      mood,
      prev,
      availableCounts: counts,
      recentKinds,
      recentIds,
      salt: i + Math.round(cp.time),
    });

    const fm: Formation = { ...picked.formation, id: genId() };
    formations.push(fm);

    const moveGapSec = (60 / Math.max(1, bpm)) * 4;
    const tStart = cp.time;
    const tEnd = Math.max(tStart + 2, nextT - moveGapSec);
    const secLabel = section?.label ? `${section.label}・` : "";
    const name = `${secLabel}${moodJa(mood)} ${picked.layout.name}`;

    cues.push({
      id: genId(),
      formationId: fm.id,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, durationSec) * 100) / 100,
      name,
      tier: cp.tier,
    });

    reasoning.push(
      `${formatClock(cp.time)} ${secLabel || ""}${moodJa(mood)} E${localEnergy.toFixed(2)} → ${picked.layout.name}`
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

/** 互換: 旧 API 用スタブ（テストが import している場合） */
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

export function buildTemplatePool(): never[] {
  return [];
}

// re-export unused ChangeTier silence for consumers
export type { ChangeTier };

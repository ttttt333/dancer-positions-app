/**
 * 変化点 → テンプレ選定（移動限界内で最大インパクト）
 */

import {
  assignPerformers,
  maxTravelMeters,
  totalTravelMeters,
} from "./assignment";
import { templatesForTier, resamplePositions } from "./templates_25p";
import type {
  ChangePoint,
  ChangeTier,
  Formation,
  GenerateFormationsResult,
  GeneratedCue,
  Template,
} from "./types";
import { METERS_PER_COUNT } from "./types";

function genId(): string {
  return (
    crypto.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function tierJa(t: ChangeTier): string {
  if (t === "major") return "大転換";
  if (t === "medium") return "中変化";
  return "微調整";
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 変化点間の利用可能カウント数。
 * 時間差 × BPM/60 × 2（8分音符換算の簡易カウント）を基本とする。
 */
export function availableCountsBetween(
  fromSec: number,
  toSec: number,
  bpm: number
): number {
  const dt = Math.max(0, toSec - fromSec);
  const beats = dt * (Math.max(1, bpm) / 60);
  // 指示: 時間 × BPM/60 × 2
  return Math.max(4, Math.floor(beats * 2));
}

export function computeMaxFeasibleDistance(availableCounts: number): number {
  return Math.max(0.6, availableCounts * METERS_PER_COUNT);
}

/**
 * 実現可能な候補のうち総移動が最大のものを選ぶ。
 * 全滅時は総移動が最小のものにフォールバック。
 */
export function pickFormationPushingLimit(
  pool: Template[],
  prev: Formation,
  availableCounts: number,
  avoidTemplateId?: string | null
): { template: Template; formation: Formation } {
  const maxDist = computeMaxFeasibleDistance(availableCounts);
  const candidates = pool.filter((t) => t.id !== avoidTemplateId);
  const list = candidates.length > 0 ? candidates : pool;

  type Cand = { template: Template; formation: Formation; total: number; max: number };
  const evaluated: Cand[] = list.map((template) => {
    const positions = resamplePositions(
      template.positions,
      prev.performers.length
    );
    const formation = assignPerformers(prev, positions);
    return {
      template,
      formation,
      total: totalTravelMeters(prev, formation),
      max: maxTravelMeters(prev, formation),
    };
  });

  const feasible = evaluated.filter((c) => c.max <= maxDist);
  const pickFrom = feasible.length > 0 ? feasible : evaluated;

  const best = pickFrom.reduce((acc, cur) => {
    if (feasible.length > 0) {
      return cur.total > acc.total ? cur : acc;
    }
    return cur.total < acc.total ? cur : acc;
  });

  return { template: best.template, formation: best.formation };
}

export type GenerateFormationsOptions = {
  /** 曲の長さ（秒）。最終キュー終端に使用 */
  durationSec?: number;
  songDynamism?: number;
};

/**
 * changePoints に沿ってフォーメーション列を生成する純アルゴリズムエンジン。
 */
export function generateFormations(
  changePoints: ChangePoint[],
  initialFormation: Formation,
  bpm: number,
  opts: GenerateFormationsOptions = {}
): GenerateFormationsResult {
  const durationSec = opts.durationSec ?? Math.max(
    60,
    ...(changePoints.map((c) => c.time + 16))
  );
  const dynamism = opts.songDynamism ?? 0.5;
  const points = [...changePoints].sort((a, b) => a.time - b.time);

  const formations: Formation[] = [];
  const cues: GeneratedCue[] = [];
  const reasoning: string[] = [];

  let prev = {
    id: initialFormation.id || genId(),
    performers: initialFormation.performers.map((p) => ({
      id: p.id,
      position: { ...p.position },
    })),
  };
  let avoidId: string | null = null;

  // 開始フォーメーション
  const startFm: Formation = { ...prev, id: genId() };
  formations.push(startFm);
  const firstT = points[0]?.time ?? durationSec;
  const introEnd = Math.max(4, Math.min(firstT - 2, durationSec));
  cues.push({
    id: genId(),
    formationId: startFm.id,
    tStartSec: 0,
    tEndSec: introEnd,
    name: "開始",
    tier: "minor",
  });
  reasoning.push(`開始隊列（BPM ${Math.round(bpm)} / dynamism ${dynamism.toFixed(2)}）`);

  for (let i = 0; i < points.length; i++) {
    const cp = points[i]!;
    const nextT = points[i + 1]?.time ?? durationSec;
    const counts = availableCountsBetween(cp.time, nextT, bpm);

    let pool = templatesForTier(cp.tier);
    // 淡々とした曲の major は medium 寄りに混ぜる
    if (cp.tier === "major" && dynamism < 0.35) {
      pool = [...templatesForTier("medium"), ...pool];
    }

    const picked = pickFormationPushingLimit(pool, prev, counts, avoidId);
    const fm: Formation = { ...picked.formation, id: genId() };
    formations.push(fm);

    const moveGapSec = (60 / Math.max(1, bpm)) * 4; // 4拍の移動余白
    const tStart = cp.time;
    const tEnd = Math.max(tStart + 2, nextT - moveGapSec);

    const name = `${tierJa(cp.tier)} ${picked.template.name}`;
    cues.push({
      id: genId(),
      formationId: fm.id,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, durationSec) * 100) / 100,
      name,
      tier: cp.tier,
    });

    reasoning.push(
      `${formatClock(cp.time)} 8×${cp.eight_index} ${tierJa(cp.tier)} → ${picked.template.name}（余裕 ${counts}カウント）`
    );

    prev = fm;
    avoidId = picked.template.id;
  }

  // キュー重なり補正
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

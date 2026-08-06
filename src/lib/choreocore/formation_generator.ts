/**
 * 変化点 → テンプレ選定（曲フェーズ連動・多様性・移動限界）
 */

import {
  assignPerformers,
  maxTravelMeters,
  totalTravelMeters,
} from "./assignment";
import {
  mirrorTemplate,
  resamplePositions,
  shiftTemplate,
  TEMPLATES_25P,
  templatesForTier,
  type TaggedTemplate,
  type TemplateEnergy,
  type TemplateShape,
} from "./templates_25p";
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

export type SongPhase = "intro" | "build" | "peak" | "outro";

export function songPhaseAt(timeSec: number, durationSec: number): SongPhase {
  const p = timeSec / Math.max(1, durationSec);
  if (p < 0.12) return "intro";
  if (p < 0.38) return "build";
  if (p < 0.78) return "peak";
  return "outro";
}

function phaseJa(p: SongPhase): string {
  if (p === "intro") return "導入";
  if (p === "build") return "盛り上げ";
  if (p === "peak") return "サビ帯";
  return "締め";
}

/**
 * 変化点間の利用可能カウント数。
 */
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
  return Math.max(0.6, availableCounts * METERS_PER_COUNT);
}

function baseId(id: string): string {
  return id.replace(/__(mx|front|back)$/, "");
}

function preferredEnergy(
  cp: ChangePoint,
  phase: SongPhase,
  dynamism: number
): TemplateEnergy {
  const score = Number.isFinite(cp.score) ? cp.score : 0.4;
  if (cp.tier === "major" || score >= 0.72 || (phase === "peak" && score >= 0.45)) {
    return dynamism < 0.3 ? "mid" : "high";
  }
  if (cp.tier === "minor" || score < 0.35 || phase === "intro") {
    return "low";
  }
  return "mid";
}

function preferredShapes(phase: SongPhase, energy: TemplateEnergy): TemplateShape[] {
  if (phase === "intro") return ["line", "cluster", "grid"];
  if (phase === "build") return ["grid", "wedge", "arc", "line"];
  if (phase === "peak") {
    return energy === "high"
      ? ["spread", "wedge", "arc", "cluster"]
      : ["wedge", "grid", "arc"];
  }
  return ["arc", "line", "cluster", "grid"];
}

/**
 * 曲位置・スコア・tier に合わせて候補プールを組み立てる。
 * 左右反転・前後シフトで見た目バリエーションを増やす。
 */
export function buildTemplatePool(opts: {
  changePoint: ChangePoint;
  durationSec: number;
  songDynamism: number;
  recentBaseIds: string[];
}): TaggedTemplate[] {
  const phase = songPhaseAt(opts.changePoint.time, opts.durationSec);
  const energy = preferredEnergy(
    opts.changePoint,
    phase,
    opts.songDynamism
  );
  const shapes = preferredShapes(phase, energy);

  let pool: TaggedTemplate[] = [];

  // tier 基本 + 隣接 tier を少し混ぜる
  pool.push(...templatesForTier(opts.changePoint.tier));
  if (opts.changePoint.tier === "major") {
    pool.push(...templatesForTier("medium"));
  } else if (opts.changePoint.tier === "minor") {
    pool.push(...templatesForTier("medium").slice(0, 4));
  } else {
    pool.push(...templatesForTier("major").slice(0, 3));
    pool.push(...templatesForTier("minor").slice(0, 3));
  }

  // energy / shape で優先フィルタ（全滅したら緩和）
  const shaped = pool.filter((t) => shapes.includes(t.shape));
  const energised = (shaped.length > 0 ? shaped : pool).filter(
    (t) => t.energy === energy || (energy === "high" && t.energy === "mid")
  );
  pool = energised.length >= 3 ? energised : shaped.length >= 3 ? shaped : pool;

  // バリエーション: 反転・前後
  const expanded: TaggedTemplate[] = [];
  for (const t of pool) {
    expanded.push(t);
    if (t.shape === "wedge" || t.shape === "spread" || t.shape === "arc") {
      expanded.push(mirrorTemplate(t));
    }
    if (phase === "peak" && t.energy !== "low") {
      expanded.push(shiftTemplate(t, 0.8, "front"));
    }
    if (phase === "intro" || phase === "outro") {
      expanded.push(shiftTemplate(t, -0.7, "back"));
    }
  }

  // 直近使用の base id を後ろへ（除外はしない）
  const recent = new Set(opts.recentBaseIds);
  expanded.sort((a, b) => {
    const ra = recent.has(baseId(a.id)) ? 1 : 0;
    const rb = recent.has(baseId(b.id)) ? 1 : 0;
    return ra - rb;
  });

  // 重複 id 除去
  const seen = new Set<string>();
  return expanded.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export type PickFormationOptions = {
  avoidTemplateIds?: string[];
  /** 0..1 多様性バイアス（未使用テンプレ優先） */
  diversityWeight?: number;
  /** 決定的ジッター用 */
  salt?: number;
};

/**
 * 実現可能な候補から「移動インパクト × 多様性」で選定。
 */
export function pickFormationPushingLimit(
  pool: Template[],
  prev: Formation,
  availableCounts: number,
  avoidTemplateId?: string | null,
  opts: PickFormationOptions = {}
): { template: Template; formation: Formation } {
  const maxDist = computeMaxFeasibleDistance(availableCounts);
  const avoid = new Set(
    [avoidTemplateId, ...(opts.avoidTemplateIds ?? [])].filter(
      (x): x is string => !!x
    )
  );
  const candidates = pool.filter((t) => !avoid.has(t.id) && !avoid.has(baseId(t.id)));
  const list = candidates.length > 0 ? candidates : pool;
  const diversityWeight = opts.diversityWeight ?? 0.55;
  const salt = opts.salt ?? 0;

  type Cand = {
    template: Template;
    formation: Formation;
    total: number;
    max: number;
    score: number;
  };

  const evaluated: Cand[] = list.map((template, idx) => {
    const positions = resamplePositions(
      template.positions,
      prev.performers.length
    );
    const formation = assignPerformers(prev, positions);
    const total = totalTravelMeters(prev, formation);
    const max = maxTravelMeters(prev, formation);
    const freshBonus = avoid.has(baseId(template.id)) ? 0 : 1.2;
    const shapeJitter = ((idx * 17 + salt * 13) % 10) * 0.03;
    const score =
      total * (1 + diversityWeight * 0.35) +
      freshBonus * diversityWeight +
      shapeJitter;
    return { template, formation, total, max, score };
  });

  const feasible = evaluated.filter((c) => c.max <= maxDist);
  const pickFrom = feasible.length > 0 ? feasible : evaluated;

  // 上位から決定的に1つ（常に同じ最大化を避ける）
  const ranked = [...pickFrom].sort((a, b) => {
    if (feasible.length > 0) return b.score - a.score;
    return a.total - b.total;
  });
  const topN = ranked.slice(0, Math.min(3, ranked.length));
  const pick = topN[(salt + ranked.length) % topN.length] ?? ranked[0]!;

  return { template: pick.template, formation: pick.formation };
}

export type GenerateFormationsOptions = {
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
  const durationSec =
    opts.durationSec ??
    Math.max(60, ...(changePoints.map((c) => c.time + 16)));
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
  const recentBaseIds: string[] = [];

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
  reasoning.push(
    `開始隊列（BPM ${Math.round(bpm)} / dynamism ${dynamism.toFixed(2)} / テンプレ ${TEMPLATES_25P.length}）`
  );

  for (let i = 0; i < points.length; i++) {
    const cp = points[i]!;
    const nextT = points[i + 1]?.time ?? durationSec;
    const counts = availableCountsBetween(cp.time, nextT, bpm);
    const phase = songPhaseAt(cp.time, durationSec);

    const pool = buildTemplatePool({
      changePoint: cp,
      durationSec,
      songDynamism: dynamism,
      recentBaseIds,
    });

    const picked = pickFormationPushingLimit(pool, prev, counts, null, {
      avoidTemplateIds: recentBaseIds.slice(-4),
      diversityWeight: 0.65,
      salt: i + Math.round(cp.time * 10),
    });
    const fm: Formation = { ...picked.formation, id: genId() };
    formations.push(fm);

    const moveGapSec = (60 / Math.max(1, bpm)) * 4;
    const tStart = cp.time;
    const tEnd = Math.max(tStart + 2, nextT - moveGapSec);

    const name = `${phaseJa(phase)}・${tierJa(cp.tier)} ${picked.template.name}`;
    cues.push({
      id: genId(),
      formationId: fm.id,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, durationSec) * 100) / 100,
      name,
      tier: cp.tier,
    });

    reasoning.push(
      `${formatClock(cp.time)} ${phaseJa(phase)} score${cp.score.toFixed(2)} ${tierJa(cp.tier)} → ${picked.template.name}（余裕 ${counts}カウント）`
    );

    prev = fm;
    recentBaseIds.push(baseId(picked.template.id));
    if (recentBaseIds.length > 8) recentBaseIds.shift();
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

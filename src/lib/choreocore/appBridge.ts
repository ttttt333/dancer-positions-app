/**
 * choreocore（メートル・中央原点）↔ アプリの Formation / Cue（%座標）変換
 */

import type {
  Cue,
  DancerSpot,
  Formation as AppFormation,
} from "../../types/choreography";
import type {
  ChangePoint,
  Formation as CoreFormation,
  GenerateFormationsResult,
  Position,
} from "./types";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "./types";
import { generateFormations } from "./formation_generator";
import { selectChangePointsForCueCount } from "./selectChangePoints";

export function metersToPct(pos: Position): { xPct: number; yPct: number } {
  const xPct = ((pos.x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100;
  const yPct = ((pos.y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100;
  return {
    xPct: Math.min(95, Math.max(5, xPct)),
    yPct: Math.min(92, Math.max(8, yPct)),
  };
}

export function pctToMeters(xPct: number, yPct: number): Position {
  return {
    x: (xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2,
    y: (yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2,
  };
}

export function dancersToCoreFormation(dancers: DancerSpot[]): CoreFormation {
  return {
    id: "seed",
    performers: dancers.map((d) => ({
      id: d.id,
      position: pctToMeters(d.xPct, d.yPct),
    })),
  };
}

function coreFormationToApp(
  core: CoreFormation,
  seedById: Map<string, DancerSpot>,
  name: string
): AppFormation {
  return {
    id: core.id,
    name,
    setPieces: [],
    dancers: core.performers.map((p, i) => {
      const seed = seedById.get(p.id);
      const { xPct, yPct } = metersToPct(p.position);
      return {
        id: p.id,
        label: seed?.label ?? String(i + 1),
        xPct,
        yPct,
        colorIndex: seed?.colorIndex ?? i % 12,
        crewMemberId: seed?.crewMemberId,
        markerBadge: seed?.markerBadge,
        markerBadgeSource: seed?.markerBadgeSource,
        sizePx: seed?.sizePx,
        note: seed?.note,
        heightCm: seed?.heightCm,
      } satisfies DancerSpot;
    }),
  };
}

export type AppGenerateResult = {
  formations: AppFormation[];
  cues: Cue[];
  reasoning: string[];
};

/**
 * 変化点からアプリ用フォーメーション／キューを生成（LLMなし）
 */
export function generateAppFormationsFromChangePoints(params: {
  changePoints: ChangePoint[];
  seedDancers: DancerSpot[];
  bpm: number;
  durationSec: number;
  songDynamism?: number;
  /** 開始を含む目標キュー数。未指定なら変化点をすべて使用 */
  targetCueCount?: number;
}): AppGenerateResult {
  const seedById = new Map(params.seedDancers.map((d) => [d.id, d] as const));
  const initial = dancersToCoreFormation(params.seedDancers);
  const points =
    params.targetCueCount != null
      ? selectChangePointsForCueCount(
          params.changePoints,
          params.targetCueCount,
          params.durationSec
        )
      : params.changePoints;
  const raw: GenerateFormationsResult = generateFormations(
    points,
    initial,
    params.bpm,
    {
      durationSec: params.durationSec,
      songDynamism: params.songDynamism,
    }
  );

  const formations = raw.formations.map((f, i) =>
    coreFormationToApp(f, seedById, raw.cues[i]?.name ?? `提案 ${i + 1}`)
  );

  // cue.formationId は raw の id のまま → formations と同じ id
  const cues: Cue[] = raw.cues.map((c) => ({
    id: c.id,
    formationId: c.formationId,
    tStartSec: c.tStartSec,
    tEndSec: c.tEndSec,
    name: c.name,
  }));

  return { formations, cues, reasoning: raw.reasoning };
}

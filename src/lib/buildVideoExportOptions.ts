import type { RefObject } from "react";
import { playbackEngine } from "../core/playbackEngine";
import { sortCuesByStart } from "../core/timelineController";
import { dancersAtTime } from "../core/stageEngine";
import {
  DANCER_COLOR_PALETTE_HEX,
  modDancerColorIndex,
} from "./dancerColorPalette";
import { resolveStageExportRange } from "./stageExportRange";
import { buildStageExportAppearance } from "./stageExportAppearance";
import { resolvePlaybackAudioUrlForExport } from "./resolvePlaybackAudioUrlForExport";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import type { ExportOptions } from "../hooks/useVideoExport";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";

/** 書き出しフレームレート（useVideoExport と揃える） */
const SAMPLE_FPS = 12;

function dancerColorHex(d: DancerSpot): string {
  return DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(d.colorIndex ?? 0)];
}

function mapDancers(dancers: DancerSpot[]) {
  return dancers.map((d) => ({
    id: d.id,
    name: d.label || "?",
    markerBadge: d.markerBadge,
    markerBadgeSource: d.markerBadgeSource,
    centerDistanceLabelXPct: d.centerDistanceLabelXPct,
    nameBelowFontPx: d.nameBelowFontPx,
    color: dancerColorHex(d),
    x: d.xPct / 100,
    y: d.yPct / 100,
  }));
}

function cueFormationName(
  project: ChoreographyProjectJson,
  formationId: string,
  cueName?: string
): string {
  const f = project.formations.find((x) => x.id === formationId);
  return (cueName || f?.name || "フォーメーション").trim() || "フォーメーション";
}

/** 書き出し尺: UI の duration と `<audio>` 実尺の大きい方を使う */
function resolveExportTrackDuration(fallbackSec: number): number {
  const fromEngine = playbackEngine.getDuration();
  const trusted = usePlaybackUiStore.getState().trustedAudioDurationSec;
  const candidates = [fallbackSec, fromEngine, trusted ?? 0].filter(
    (n) => Number.isFinite(n) && n > 0
  );
  return candidates.length > 0 ? Math.max(...candidates) : fallbackSec;
}

/**
 * `useVideoExport` 向けにプロジェクト JSON から ExportOptions を組み立てる。
 * キュー境界に加え、30fps 相当で補間サンプルを入れてギャップ中も動く。
 */
export function buildVideoExportOptions(
  project: ChoreographyProjectJson,
  durationSec: number,
  fileName: string,
  canvasRef: RefObject<HTMLCanvasElement | null>
): ExportOptions {
  const trackDurationSec = resolveExportTrackDuration(durationSec);
  const { startSec, durationSec: span } = resolveStageExportRange(
    trackDurationSec,
    project.trimStartSec ?? 0,
    project.trimEndSec
  );

  const formations: ExportOptions["formations"] = [];
  const totalFrames = Math.max(1, Math.ceil(span * SAMPLE_FPS));
  const sorted = sortCuesByStart(project.cues);

  for (let frame = 0; frame <= totalFrames; frame++) {
    const tRel = frame / SAMPLE_FPS;
    const tAbs = startSec + tRel;
    const dancers = dancersAtTime(
      tAbs,
      project.cues,
      project.formations,
      project.activeFormationId
    );

    const activeCue =
      [...sorted].reverse().find((c) => c.tStartSec <= tAbs) ?? sorted[0];
    const label = activeCue
      ? cueFormationName(project, activeCue.formationId, activeCue.name)
      : "ステージ";

    formations.push({
      id: `frame-${frame}`,
      name: label,
      startSec: tRel,
      dancers: mapDancers(dancers),
    });
  }

  if (formations.length === 0) {
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    formations.push({
      id: f?.id ?? "default",
      name: f?.name ?? "ステージ",
      startSec: 0,
      dancers: mapDancers(f?.dancers ?? []),
    });
  }

  const safeName =
    fileName.replace(/[^\w\u3000-\u30ff\u4e00-\u9faf-]+/g, "_").slice(0, 80) ||
    "choreogrid";

  return {
    canvasRef,
    audioUrl: resolvePlaybackAudioUrlForExport(),
    durationSec: span,
    fileName: safeName,
    formations,
    stageAppearance: buildStageExportAppearance(project),
    audioStartSec: startSec,
  };
}

/**
 * 解析結果を音楽セクション・オーバーレイ store へ反映する。
 */

import type { AudioAnalysisResult } from "../../types/audioAnalysis";
import type { StructureResultV2 } from "../choreocore/types/songStructure";
import {
  segmentsFromChangePoints,
  segmentsFromMusicSections,
  type MusicSectionOverlaySegment,
} from "../musicSectionOverlay";
import type { ChangePoint } from "../choreocore/types";
import { useMusicSectionOverlayStore } from "../../store/musicSectionOverlayStore";
import {
  audioAnalysisFromStructureV2,
  beatsFromEightTimes,
  musicSectionFromRaw,
  overlaySegmentsFromAnalysis,
} from "./fromStructureV2";
import { mapEngineTypeToSectionType } from "./sectionMeta";
import { applyDownbeatSnapToAnalysis } from "./snapToDownbeat";

export function publishAudioAnalysisOverlay(
  analysis: AudioAnalysisResult,
  opts?: { applySnap?: boolean; force?: boolean }
): void {
  if (useMusicSectionOverlayStore.getState().userEdited && !opts?.force) {
    useMusicSectionOverlayStore.getState().setAnalyzing(false);
    return;
  }
  const final =
    opts?.applySnap === false
      ? analysis
      : applyDownbeatSnapToAnalysis(analysis);
  const segments = overlaySegmentsFromAnalysis(
    final
  ) as MusicSectionOverlaySegment[];
  useMusicSectionOverlayStore
    .getState()
    .setFromAnalysis(final, segments, { force: opts?.force });
}

/** Structure v2 優先。無ければ changePoints / eval sections にフォールバック。 */
export function publishSnappedOverlayFromSources(opts: {
  duration: number;
  sourceLabel?: string | null;
  structureV2?: StructureResultV2 | null;
  changePoints?: ChangePoint[] | undefined;
  evalSections?: Array<{ type: string; startTime: number; endTime: number }>;
  eightTimes?: number[];
  bpm?: number;
  /** true のとき手動編集済みでも上書き（AI提案など明示操作） */
  force?: boolean;
}): AudioAnalysisResult | null {
  const { duration, sourceLabel, force } = opts;

  if (
    useMusicSectionOverlayStore.getState().userEdited &&
    !force
  ) {
    useMusicSectionOverlayStore.getState().setAnalyzing(false);
    return null;
  }

  if (opts.structureV2?.sections?.length) {
    const analysis = audioAnalysisFromStructureV2(opts.structureV2, {
      applySnap: true,
    });
    if (sourceLabel) analysis.sourceLabel = sourceLabel;
    publishAudioAnalysisOverlay(analysis, { applySnap: false, force });
    return analysis;
  }

  const fromEval =
    opts.evalSections && opts.evalSections.length > 0
      ? segmentsFromMusicSections(opts.evalSections, duration)
      : [];
  const segments =
    fromEval.length > 0
      ? fromEval
      : segmentsFromChangePoints(opts.changePoints, duration);

  const eightTimes =
    opts.eightTimes?.length
      ? opts.eightTimes
      : opts.structureV2?.eight_times ?? [];
  const beats =
    eightTimes.length > 0
      ? beatsFromEightTimes(eightTimes, duration)
      : [];

  if (segments.length === 0 && beats.length === 0) {
    useMusicSectionOverlayStore
      .getState()
      .setSegments([], duration, sourceLabel ?? null);
    return null;
  }

  const analysis: AudioAnalysisResult = applyDownbeatSnapToAnalysis({
    duration,
    beats,
    sections: segments.map((seg) =>
      musicSectionFromRaw({
        type: mapEngineTypeToSectionType(seg.sectionType),
        startTime: seg.startSec,
        endTime: seg.endSec,
        label: seg.label,
        bpm: opts.bpm,
      })
    ),
    sourceLabel: sourceLabel ?? undefined,
    bpm: opts.bpm,
  });

  // スナップ後の時刻でオーバーレイ色を再構築
  publishAudioAnalysisOverlay(analysis, { applySnap: false, force });
  return analysis;
}

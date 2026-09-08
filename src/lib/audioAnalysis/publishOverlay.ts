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
  beatsFromTempo,
  musicSectionFromRaw,
  overlaySegmentsFromAnalysis,
} from "./fromStructureV2";
import { mapEngineTypeToSectionType } from "./sectionMeta";
import { applyDownbeatSnapToAnalysis } from "./snapToDownbeat";
import { cleanseMusicSections } from "./cleanseSections";
import {
  inferTempoFromEightTimes,
  logAudioAnalysisEngine,
} from "./evenBeatGrid";

export function publishAudioAnalysisOverlay(
  analysis: AudioAnalysisResult,
  opts?: { applySnap?: boolean; force?: boolean }
): void {
  if (useMusicSectionOverlayStore.getState().userEdited && !opts?.force) {
    useMusicSectionOverlayStore.getState().setAnalyzing(false);
    return;
  }
  let final =
    opts?.applySnap === false
      ? analysis
      : applyDownbeatSnapToAnalysis(analysis);

  const bpm = final.bpm && final.bpm > 0 ? final.bpm : 120;
  final = {
    ...final,
    sections: cleanseMusicSections(final.sections, {
      duration: final.duration,
      bpm,
    }),
  };

  // ビートが不揃い／空なら BPM 均等グリッドで差し替え
  if (final.beats.length < 2 || !isEvenGrid(final.beats, bpm)) {
    final = {
      ...final,
      beats: beatsFromTempo({
        bpm,
        duration: final.duration,
        firstDownbeatTime: final.beats.find((b) => b.isDownbeat)?.timestamp ?? 0,
      }),
    };
  }

  const segments = overlaySegmentsFromAnalysis(
    final
  ) as MusicSectionOverlaySegment[];
  useMusicSectionOverlayStore
    .getState()
    .setFromAnalysis(final, segments, { force: opts?.force });
}

function isEvenGrid(beats: AudioAnalysisResult["beats"], bpm: number): boolean {
  if (beats.length < 3) return false;
  const spb = 60 / Math.max(1, bpm);
  let checked = 0;
  for (let i = 1; i < Math.min(beats.length, 24); i += 1) {
    const gap = beats[i]!.timestamp - beats[i - 1]!.timestamp;
    if (Math.abs(gap - spb) > spb * 0.12) return false;
    checked += 1;
  }
  return checked > 0;
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
      cleanse: true,
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
  const inferred = eightTimes.length
    ? inferTempoFromEightTimes(eightTimes)
    : null;
  const bpm =
    opts.bpm && opts.bpm > 0
      ? opts.bpm
      : inferred?.bpm && inferred.bpm > 0
        ? inferred.bpm
        : 120;
  const firstDownbeatTime = inferred?.firstDownbeatTime ?? 0;
  const beats = beatsFromTempo({ bpm, duration, firstDownbeatTime });

  if (segments.length === 0 && beats.length === 0) {
    useMusicSectionOverlayStore
      .getState()
      .setSegments([], duration, sourceLabel ?? null);
    return null;
  }

  let analysis: AudioAnalysisResult = {
    duration,
    beats,
    sections: segments.map((seg) =>
      musicSectionFromRaw({
        type: mapEngineTypeToSectionType(seg.sectionType),
        startTime: seg.startSec,
        endTime: seg.endSec,
        label: seg.label,
        bpm,
      })
    ),
    sourceLabel: sourceLabel ?? undefined,
    bpm,
  };

  analysis = applyDownbeatSnapToAnalysis(analysis);
  analysis = {
    ...analysis,
    sections: cleanseMusicSections(analysis.sections, { duration, bpm }),
  };

  logAudioAnalysisEngine({
    engine: sourceLabel ?? "change-points",
    bpm,
    beatsCount: analysis.beats.length,
    sectionsCount: analysis.sections.length,
    sourceLabel,
  });

  publishAudioAnalysisOverlay(analysis, { applySnap: false, force });
  return analysis;
}

/**
 * 音源ロード後のバックグラウンド自動解析。
 * AI提案ダイアログを開かなくてもセクション色分け＋ビートグリッドを埋める。
 */

import { fetchRemoteSongAnalysis } from "../songAnalyzeClient";
import { analyzeSongStructureFromPeaks } from "../songStructureAnalysis";
import { isPlaceholderLikeWavePeaks } from "../placeholderWavePeaks";
import { useMusicSectionOverlayStore } from "../../store/musicSectionOverlayStore";
import { showAppToast } from "../../store/appToastStore";
import {
  beatsFromEightTimes,
  musicSectionFromRaw,
} from "./fromStructureV2";
import { mapEngineTypeToSectionType } from "./sectionMeta";
import { applyDownbeatSnapToAnalysis } from "./snapToDownbeat";
import {
  publishAudioAnalysisOverlay,
  publishSnappedOverlayFromSources,
} from "./publishOverlay";
import type { AudioAnalysisResult } from "../../types/audioAnalysis";
import { segmentsFromChangePoints } from "../musicSectionOverlay";

export type AutoAudioAnalysisInput = {
  audioSupabasePath?: string | null;
  audioUrl?: string | null;
  trackTitle?: string | null;
  peaks: number[];
  durationSec: number;
  /** 同一音源の二重起動防止キー */
  cacheKey?: string | null;
  signal?: AbortSignal;
};

export type AutoAudioAnalysisOutcome =
  | "ok"
  | "skipped"
  | "aborted"
  | "error";

let lastStartedKey: string | null = null;
let inFlightKey: string | null = null;

function analysisKey(input: AutoAudioAnalysisInput): string {
  return [
    input.cacheKey ?? "",
    input.audioSupabasePath ?? "",
    input.audioUrl ?? "",
    Math.round(input.durationSec * 10),
    input.peaks.length,
  ].join("|");
}

/** 音源切替時などに呼び出し、二重起動ガードをリセット */
export function resetAutoAudioAnalysisGuard(): void {
  lastStartedKey = null;
  inFlightKey = null;
}

/**
 * リモート解析 → 失敗時はブラウザ peaks 解析。
 * ユーザーがセクション境界を手動編集済みならセクションは上書きしない。
 */
export async function runAutoAudioAnalysis(
  input: AutoAudioAnalysisInput
): Promise<AutoAudioAnalysisOutcome> {
  const store = useMusicSectionOverlayStore.getState();
  if (store.userEdited) return "skipped";

  if (
    !input.peaks.length ||
    input.durationSec <= 0 ||
    isPlaceholderLikeWavePeaks(input.peaks)
  ) {
    return "skipped";
  }

  const key = analysisKey(input);
  if (inFlightKey === key || lastStartedKey === key) {
    // 既に同じ音源で成功／実行中
    if (store.segments.length > 0 || store.beats.length > 0) return "skipped";
    if (inFlightKey === key) return "skipped";
  }

  const hasRemoteSource =
    (typeof input.audioSupabasePath === "string" &&
      input.audioSupabasePath.trim().length > 0) ||
    (typeof input.audioUrl === "string" &&
      /^https?:\/\//i.test(input.audioUrl.trim()));

  inFlightKey = key;
  lastStartedKey = key;
  store.setAnalyzing(true, "AIがBPMとビートを展開解析中…");

  try {
    if (input.signal?.aborted) {
      lastStartedKey = null;
      useMusicSectionOverlayStore.getState().setAnalyzing(false);
      return "aborted";
    }

    let published = false;

    if (hasRemoteSource) {
      const remote = await fetchRemoteSongAnalysis({
        audioSupabasePath: input.audioSupabasePath,
        audioUrl: input.audioUrl,
        trackTitle: input.trackTitle,
        signal: input.signal,
        timeoutMs: 45000,
      });

      if (input.signal?.aborted) {
        lastStartedKey = null;
        useMusicSectionOverlayStore.getState().setAnalyzing(false);
        return "aborted";
      }

      if (remote) {
        const sourceLabel =
          remote.source === "cache"
            ? "fly-cache"
            : remote.source === "direct"
              ? "fly-direct"
              : "fly";
        const result = publishSnappedOverlayFromSources({
          duration: remote.duration || input.durationSec,
          sourceLabel,
          structureV2: remote.structure_v2,
          changePoints: remote.change_points,
          eightTimes: remote.structure_v2?.eight_times,
          bpm: remote.bpm,
        });
        published =
          result != null ||
          useMusicSectionOverlayStore.getState().segments.length > 0;
      }
    }

    if (input.signal?.aborted) {
      lastStartedKey = null;
      useMusicSectionOverlayStore.getState().setAnalyzing(false);
      return "aborted";
    }

    // 手動編集が割り込んだら上書きしない
    if (useMusicSectionOverlayStore.getState().userEdited) {
      useMusicSectionOverlayStore.getState().setAnalyzing(false);
      return "skipped";
    }

    if (!published || useMusicSectionOverlayStore.getState().segments.length === 0) {
      publishBrowserFallback(input.peaks, input.durationSec);
    }

    // beats だけでもグリッドを出したい場合の最終フォールバック
    const after = useMusicSectionOverlayStore.getState();
    if (after.beats.length === 0 && after.segments.length === 0) {
      publishBrowserFallback(input.peaks, input.durationSec);
    }

    useMusicSectionOverlayStore.getState().setAnalyzing(false);
    return "ok";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "aborted";
    useMusicSectionOverlayStore.getState().setAnalyzing(false);
    lastStartedKey = null;
    showAppToast({
      kind: "info",
      title: "曲の自動解析をスキップしました",
      description: "波形はそのまま使えます。AI提案から再解析もできます。",
    });
    return "error";
  } finally {
    if (inFlightKey === key) inFlightKey = null;
  }
}

function publishBrowserFallback(peaks: number[], durationSec: number): void {
  if (useMusicSectionOverlayStore.getState().userEdited) return;

  const browser = analyzeSongStructureFromPeaks(peaks, durationSec);
  const eightTimes = browser.eight_grid.map((e) => e.start_time);
  const beats = beatsFromEightTimes(eightTimes, browser.duration, 8);
  const overlaySegs = segmentsFromChangePoints(
    browser.change_points,
    browser.duration
  );

  const sections = overlaySegs.map((seg) =>
    musicSectionFromRaw({
      type: mapEngineTypeToSectionType(seg.sectionType),
      startTime: seg.startSec,
      endTime: seg.endSec,
      label: seg.label,
      bpm: browser.bpm,
    })
  );

  const analysis: AudioAnalysisResult = applyDownbeatSnapToAnalysis({
    duration: browser.duration,
    beats,
    sections: sections.map((s, i) => ({
      ...s,
      color: overlaySegs[i]?.color ?? s.color,
      label: overlaySegs[i]?.label ?? s.label,
    })),
    sourceLabel: "browser-auto",
    bpm: browser.bpm,
  });

  publishAudioAnalysisOverlay(analysis, { applySnap: false });
}

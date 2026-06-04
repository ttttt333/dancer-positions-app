import { playbackEngine } from "../core/playbackEngine";
import {
  isPlaybackBeforeTrimStart,
  isPlaybackPastTrimEnd,
  PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS,
  roundPlaybackHeadSec,
} from "../core/timelineController";
import { PLACEHOLDER_TIMELINE_CAP_SEC } from "./cueInterval";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  clearViewerPendingPlay,
  hasViewerPlayIntent,
  setViewerPendingPlay,
  startViewerEnginePlayback,
} from "./playbackViewerIntent";

/** キュー終端から閲覧用のタイムライン尺（秒） */
export function viewerTimelineDurationSec(
  project: ChoreographyProjectJson | null
): number {
  if (!project || project.cues.length === 0) return 0;
  let max = 0;
  for (const c of project.cues) {
    if (Number.isFinite(c.tEndSec)) max = Math.max(max, c.tEndSec);
  }
  return max;
}

/** 音源尺が無いとき、キューから表示用 duration を補う */
export function syncViewerDurationFromProject(
  project: ChoreographyProjectJson | null
): void {
  const cueDur = viewerTimelineDurationSec(project);
  if (cueDur <= 0) return;
  const store = usePlaybackUiStore.getState();
  if (store.durationSec <= 0) {
    store.setDurationSec(cueDur);
  }
}

function viewerPlaybackCapSec(
  project: ChoreographyProjectJson,
  storeDuration: number
): number {
  const cueDur = viewerTimelineDurationSec(project);
  const audioDur = storeDuration > 0 ? storeDuration : 0;
  const trimEnd = project.trimEndSec;
  let cap = Math.max(cueDur, audioDur, PLACEHOLDER_TIMELINE_CAP_SEC * 0.01);
  if (typeof trimEnd === "number" && Number.isFinite(trimEnd) && trimEnd > 0) {
    cap = Math.min(cap, trimEnd);
  }
  return cap;
}

/**
 * 閲覧共有: 音源未接続でも isPlaying 中はヘッドを進め、立ち位置補間を表示する。
 */
export function advanceViewerPlaybackHead(
  project: ChoreographyProjectJson,
  deltaSec: number
): void {
  const store = usePlaybackUiStore.getState();
  const trimStart = project.trimStartSec ?? 0;
  const trimEnd = project.trimEndSec;
  const cap = viewerPlaybackCapSec(project, store.durationSec);
  let t = store.currentTimeSec + deltaSec * (project.playbackRate ?? 1);
  if (isPlaybackBeforeTrimStart(t, trimStart)) t = trimStart;
  if (
    isPlaybackPastTrimEnd({
      t,
      trimEndSec: trimEnd,
      durationSec: cap,
      durationFallbackSec: cap,
    })
  ) {
    playbackEngine.pause();
    store.setIsPlaying(false);
    store.setCurrentTimeSec(trimStart);
    clearViewerPendingPlay();
    return;
  }
  store.setCurrentTimeSec(roundPlaybackHeadSec(t));
}

/** 閲覧共有の再生トグル（音源なしでもタイムライン再生） */
export function toggleViewerPlayback(
  project: ChoreographyProjectJson,
  trimStartSec: number
): void {
  const store = usePlaybackUiStore.getState();
  syncViewerDurationFromProject(project);

  if (store.isPlaying) {
    if (
      playbackEngine.getMediaSourceUrl() &&
      playbackEngine.isPaused() &&
      hasViewerPlayIntent()
    ) {
      startViewerEnginePlayback(trimStartSec);
      return;
    }
    playbackEngine.pause();
    store.setIsPlaying(false);
    clearViewerPendingPlay();
    return;
  }

  if (isPlaybackBeforeTrimStart(store.currentTimeSec, trimStartSec)) {
    store.setCurrentTimeSec(trimStartSec);
  }

  if (playbackEngine.getMediaSourceUrl()) {
    startViewerEnginePlayback(trimStartSec);
    return;
  }

  setViewerPendingPlay(trimStartSec);
}

export { PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS };

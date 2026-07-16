import { playbackEngine } from "../core/playbackEngine";
import { waveViewStartForPlayheadAtScreenCenter } from "./waveTimelineSeek";

/** 最小表示割合（小さいほど拡大できる）。0.3秒キュー操作のため十分に拡大可能にする */
export const WAVE_VIEWPORT_MIN_PORTION = 0.0075;
/** ボタン1回あたりの拡大率（ホイールと近い体感） */
export const WAVE_ZOOM_BUTTON_STEP_MULT = 0.82;

export type WaveZoomDirection = "in" | "out";

export function waveZoomPortionMultiplier(direction: WaveZoomDirection): number {
  return direction === "in" ? WAVE_ZOOM_BUTTON_STEP_MULT : 1 / WAVE_ZOOM_BUTTON_STEP_MULT;
}

export function clampWaveViewPortion(viewPortion: number): number {
  return Math.min(1, Math.max(WAVE_VIEWPORT_MIN_PORTION, viewPortion));
}

export function resolveWaveZoomPlayheadSec(params: {
  currentTimeSec: number;
  isPlaying: boolean;
}): number {
  if (
    params.isPlaying &&
    playbackEngine.getMediaSourceUrl() &&
    !playbackEngine.isPaused() &&
    Number.isFinite(playbackEngine.getCurrentTime())
  ) {
    return playbackEngine.getCurrentTime();
  }
  return params.currentTimeSec;
}

/** 再生バー（赤いバー）を画面中央付近に保ったまま viewPortion を更新 */
export function applyWaveViewportZoomMultiplier(params: {
  currentViewPortion: number;
  multiplier: number;
  playheadSec: number;
  durationSec: number;
}): { viewPortion: number; viewStartOverride: number | null } {
  const { durationSec, playheadSec, multiplier } = params;
  if (durationSec <= 0) {
    return {
      viewPortion: params.currentViewPortion,
      viewStartOverride: null,
    };
  }

  const newVp = clampWaveViewPortion(params.currentViewPortion * multiplier);
  if (newVp >= 1 - 1e-9) {
    return { viewPortion: newVp, viewStartOverride: null };
  }

  const newStart = waveViewStartForPlayheadAtScreenCenter({
    playheadTimeSec: playheadSec,
    durationSec,
    viewPortion: newVp,
  });

  return {
    viewPortion: newVp,
    viewStartOverride: newStart,
  };
}

export function applyWaveViewportZoomStep(params: {
  currentViewPortion: number;
  direction: WaveZoomDirection;
  playheadSec: number;
  durationSec: number;
}): { viewPortion: number; viewStartOverride: number | null } {
  return applyWaveViewportZoomMultiplier({
    ...params,
    multiplier: waveZoomPortionMultiplier(params.direction),
  });
}

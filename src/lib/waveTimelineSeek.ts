import type { Dispatch, SetStateAction } from "react";
import {
  seekPlaybackClampedAndSyncStore,
  seekPlaybackDuringScrub,
  type PlaybackScrubSession,
} from "./playbackTransport";
import {
  resolveWaveViewForPointerHit,
  resolveWavePlayheadFollowViewStart,
  waveExtentXToTime,
  waveVisibleSpanSec,
} from "./timelineWaveGeometry";
import {
  clampWaveViewStart,
  isWaveEdgeScrollZone,
  WAVE_WHEEL_ZOOM_PLAYHEAD_SCREEN_FRAC,
} from "./waveEdgeScrollDuringScrub";

export type WaveTimelineSeekViewContext = {
  durationSec: number;
  viewPortion: number;
  isPlaying: boolean;
  viewStartOverride: number | null;
  anchorTimeSec: number;
  playheadScrubArmed?: boolean;
  enginePaused?: boolean;
  lastDrawRange?: { viewStart: number; viewSpan: number } | null;
};

/** クリック／ドラッグ位置に再生バーが来るよう viewStart を決める（11% 固定追従ではない） */
export function panWaveViewStartForPlayheadAtClientX(params: {
  scrubTimeSec: number;
  clientX: number;
  canvasRect: DOMRect;
  durationSec: number;
  viewPortion: number;
}): number | null {
  const { scrubTimeSec, clientX, canvasRect, durationSec, viewPortion } = params;
  if (viewPortion >= 1 - 1e-9 || durationSec <= 0 || !Number.isFinite(scrubTimeSec)) {
    return null;
  }
  const span = waveVisibleSpanSec(durationSec, viewPortion);
  const width = canvasRect.width;
  if (width <= 0) return null;
  const x = Math.max(0, Math.min(width, clientX - canvasRect.left));
  const frac = x / width;
  return clampWaveViewStart(scrubTimeSec - frac * span, span, durationSec);
}

/**
 * ホイールズーム時: 再生バー（赤いバー）が画面中央付近に来るよう viewStart を決める。
 */
export function waveViewStartForPlayheadAtScreenCenter(params: {
  playheadTimeSec: number;
  durationSec: number;
  viewPortion: number;
  screenCenterFrac?: number;
}): number | null {
  const {
    playheadTimeSec,
    durationSec,
    viewPortion,
    screenCenterFrac = WAVE_WHEEL_ZOOM_PLAYHEAD_SCREEN_FRAC,
  } = params;
  if (
    viewPortion >= 1 - 1e-9 ||
    durationSec <= 0 ||
    !Number.isFinite(playheadTimeSec)
  ) {
    return null;
  }
  return resolveWavePlayheadFollowViewStart(
    playheadTimeSec,
    durationSec,
    viewPortion,
    screenCenterFrac
  );
}

export type CommitWaveTimelineSeekParams = WaveTimelineSeekViewContext & {
  clientX: number;
  canvas: HTMLCanvasElement;
  trimStartSec: number;
  trimEndSec: number | null;
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
  scrubSession?: PlaybackScrubSession | null;
  roundHeadForStore?: boolean;
};

/**
 * 波形／目盛りクリック: 時刻へシークし、ズーム中はクリック位置に赤バーが来るよう表示窓を合わせる。
 */
export function commitWaveTimelineSeekAtClientX(
  params: CommitWaveTimelineSeekParams
): number | null {
  const {
    clientX,
    canvas,
    durationSec,
    viewPortion,
    isPlaying,
    viewStartOverride,
    anchorTimeSec,
    playheadScrubArmed,
    enginePaused,
    trimStartSec,
    trimEndSec,
    setWaveViewStartOverride,
    scrubSession = null,
    roundHeadForStore = true,
  } = params;
  if (durationSec <= 0) return null;

  const rect = canvas.getBoundingClientRect();
  const { viewStart, viewSpan } = resolveWaveViewForPointerHit({
    durationSec,
    viewPortion,
    isPlaying,
    viewStartOverride,
    anchorTimeSec,
    playheadScrubArmed,
    enginePaused,
    lastDrawRange: params.lastDrawRange,
  });
  if (viewSpan <= 0 || rect.width <= 0) return null;

  const t = waveExtentXToTime(clientX - rect.left, viewStart, viewSpan, rect.width);
  const seekParams = {
    t,
    durationSec,
    trimStartSec,
    trimEndSec,
    roundHeadForStore: roundHeadForStore as const,
  };
  const moved =
    scrubSession != null
      ? seekPlaybackDuringScrub(seekParams, scrubSession)
      : seekPlaybackClampedAndSyncStore(seekParams);
  if (moved == null) return null;

  const skipViewPanForEdgeScrub =
    scrubSession != null && isWaveEdgeScrollZone(clientX, rect);
  if (!skipViewPanForEdgeScrub) {
    const nextStart = panWaveViewStartForPlayheadAtClientX({
      scrubTimeSec: moved,
      clientX,
      canvasRect: rect,
      durationSec,
      viewPortion,
    });
    if (nextStart != null) {
      setWaveViewStartOverride(nextStart);
    } else if (viewPortion >= 1 - 1e-9) {
      setWaveViewStartOverride(null);
    }
  }
  return moved;
}

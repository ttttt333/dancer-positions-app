import { playbackEngine } from "../core/playbackEngine";
import {
  clampSeekTimeSec,
  isPlaybackBeforeTrimStart,
  roundPlaybackHeadSec,
} from "../core/timelineController";
import { PLACEHOLDER_TIMELINE_CAP_SEC } from "./cueInterval";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/**
 * 再生エンジンと `usePlaybackUiStore` をつなぐ操作の集約。
 *
 * - 通常シーク（波形クリック・±秒など）: `seekPlaybackClampedAndSyncStore`
 * - キュー作成／複製直後（実尺 0 でもプレースホルダ上限で clamp）: `syncPlaybackHeadAfterCueEdit`
 * - 停止・トリム先頭: `stopPlaybackAtTrimStart` / `pauseAndSeekPlaybackToSec`
 * - 再生トグル: `togglePlaybackRespectingTrimStart`
 *
 * キュー境界・ヘッド秒の純関数は `core/timelineController`（`playbackTrim`）へ集約。
 */

export type SeekPlaybackClampedParams = {
  /** 目標の絶対秒（トリム・実尺で clamp される） */
  t: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number | null;
  /**
   * 既定は `durationSec`。実尺 0 のときにプレースホルダ上限を使う場合だけ上書き。
   */
  durationFallbackSec?: number;
  /** true のとき、ストア同期・シーク先を `roundPlaybackHeadSec` する（波形スクラブ等） */
  roundHeadForStore?: boolean;
};

/**
 * トリム内に clamp してシークし、`currentTimeSec` をストアに同期する。
 * メディア未設定、または実尺もフォールバックも正でないときは何もしない。
 * @returns シークした秒（早期 return 時は `null`）
 */
export function seekPlaybackClampedAndSyncStore(
  params: SeekPlaybackClampedParams
): number | null {
  if (!playbackEngine.getMediaSourceUrl()) return null;
  const d = params.durationSec;
  const fallback = params.durationFallbackSec ?? d;
  if (d <= 0 && fallback <= 0) return null;
  const nextRaw = clampSeekTimeSec({
    t: params.t,
    trimStartSec: params.trimStartSec,
    trimEndSec: params.trimEndSec,
    durationSec: d,
    durationFallbackSec: fallback,
  });
  const next = params.roundHeadForStore
    ? roundPlaybackHeadSec(nextRaw)
    : nextRaw;
  playbackEngine.seek(next);
  usePlaybackUiStore.getState().setCurrentTimeSec(next);
  return next;
}

export type SyncPlaybackHeadAfterCueParams = {
  /** キュー先頭など、ストアに合わせたい目標秒 */
  t: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number | null;
};

/**
 * 新規／複製キュー直後: 実尺 0 でもタイムライン上限（プレースホルダ）で clamp してシークし、ストアと一致させる。
 * メディア URL が無いときはシークせず `t` をそのまま `currentTimeSec` にする。
 */
export function syncPlaybackHeadAfterCueEdit(
  params: SyncPlaybackHeadAfterCueParams
): void {
  const synced = seekPlaybackClampedAndSyncStore({
    t: params.t,
    durationSec: params.durationSec,
    trimStartSec: params.trimStartSec,
    trimEndSec: params.trimEndSec,
    durationFallbackSec: PLACEHOLDER_TIMELINE_CAP_SEC,
  });
  if (synced == null) {
    usePlaybackUiStore.getState().setCurrentTimeSec(params.t);
  }
}

export type PauseAndSeekPlaybackParams = {
  tRaw: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number | null;
};

/**
 * 再生を止め、トリム内に収めた秒へシークする（キュージャンプ・新規キュー作成など）。
 * 音源未設定時も UI の `currentTime` / `isPlaying` は更新する。
 */
export function pauseAndSeekPlaybackToSec(
  params: PauseAndSeekPlaybackParams
): void {
  const { tRaw, durationSec, trimStartSec, trimEndSec } = params;
  const d = durationSec;
  /** 実尺がまだ無いときはトリムに寄せず 0 下限のみ（従来 Timeline と同じ）。 */
  const clamped =
    d > 0 && Number.isFinite(tRaw)
      ? clampSeekTimeSec({
          t: tRaw,
          trimStartSec,
          trimEndSec,
          durationSec: d,
          durationFallbackSec: d,
        })
      : Math.max(0, tRaw);

  usePlaybackUiStore.getState().setIsPlaying(false);
  if (playbackEngine.getMediaSourceUrl() && Number.isFinite(clamped)) {
    playbackEngine.pause();
    playbackEngine.seek(clamped);
  }
  usePlaybackUiStore.getState().setCurrentTimeSec(clamped);
}

/**
 * 再生を止めてトリム左端へシークする（タイムライン停止 UI・ステージ床タップなど共通）。
 */
export function stopPlaybackAtTrimStart(trimStartSec: number): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  playbackEngine.pause();
  usePlaybackUiStore.getState().setIsPlaying(false);
  const t = Math.max(0, trimStartSec);
  if (Number.isFinite(t)) {
    playbackEngine.seek(t);
    usePlaybackUiStore.getState().setCurrentTimeSec(t);
  }
}

/**
 * 再生/一時停止のトグル。一時停止から再生に入るとき、ヘッドがトリム開始より左なら先にシークする。
 */
export function togglePlaybackRespectingTrimStart(trimStartSec: number): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  if (playbackEngine.isPaused()) {
    if (
      isPlaybackBeforeTrimStart(
        playbackEngine.getCurrentTime(),
        trimStartSec
      )
    ) {
      playbackEngine.seek(trimStartSec);
    }
    void playbackEngine.play();
  } else {
    playbackEngine.pause();
  }
}

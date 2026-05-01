/**
 * トリム（書き出し）範囲と実尺に基づくシーク位置の clamp、再生ヘッドの丸め・ストア同期間隔。
 * 実際の `HTMLAudioElement` への `currentTime` 代入は `playbackEngine` 側。
 * キュー編集の境界・ヘッド正規化: `trimHiSecForCueTimeline` / `clampTimelineHeadForCueOps`。
 */

import { PLACEHOLDER_TIMELINE_CAP_SEC } from "../lib/cueInterval";

export type ClampSeekTimeParams = {
  t: number;
  trimStartSec: number;
  trimEndSec: number | null;
  /** メディア等から得た実尺。正ならそれを上限の素にする */
  durationSec: number;
  /** `durationSec` が 0 以下のときの上限（プレースホルダ尺など） */
  durationFallbackSec: number;
};

export function effectiveDurationCapSec(
  durationSec: number,
  durationFallbackSec: number
): number {
  return durationSec > 0 ? durationSec : durationFallbackSec;
}

export function trimPlaybackEndSec(params: {
  trimEndSec: number | null;
  durationSec: number;
  durationFallbackSec: number;
}): number {
  const cap = effectiveDurationCapSec(
    params.durationSec,
    params.durationFallbackSec
  );
  return params.trimEndSec ?? cap;
}

export function clampSeekTimeSec(params: ClampSeekTimeParams): number {
  const hi = trimPlaybackEndSec(params);
  return Math.max(params.trimStartSec, Math.min(hi, params.t));
}

/** トリム終端を過ぎたか（終端が正のときのみ true） */
export function isPlaybackPastTrimEnd(params: {
  t: number;
  trimEndSec: number | null;
  durationSec: number;
  durationFallbackSec: number;
}): boolean {
  const end = trimPlaybackEndSec(params);
  return end > 0 && params.t >= end;
}

export function isPlaybackBeforeTrimStart(
  t: number,
  trimStartSec: number
): boolean {
  return t < trimStartSec;
}

/** 再生ヘッド秒（UI `currentTime` と同じ ms 丸め） */
export function roundPlaybackHeadSec(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/**
 * 再生中にストアの `currentTimeSec` を更新する最小間隔（ms）。
 * ステージ補間の滑らかさと再描画負荷の兼ね合い（RAF は毎フレーム回し、書き込みだけ間引く）。
 */
export const PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS = 12;

export type CanSplitCueAtTimeParams = {
  splitAtSec: number;
  cueStartSec: number;
  cueEndSec: number;
  /** 端からの最小余白（秒） */
  minEdgeSec?: number;
};

/** キュー区間の内側に十分な余白があるときだけ分割可能 */
export function canSplitCueAtTime(params: CanSplitCueAtTimeParams): boolean {
  const edge = params.minEdgeSec ?? 0.02;
  const { splitAtSec, cueStartSec, cueEndSec } = params;
  return splitAtSec > cueStartSec + edge && splitAtSec < cueEndSec - edge;
}

/**
 * キュー編集で使うトリム右端（秒）: `trimEndSec` が null のとき、実尺またはプレースホルダ上限を使う。
 */
export function trimHiSecForCueTimeline(
  trimEndSec: number | null,
  durationSec: number
): number {
  const d = durationSec;
  return trimPlaybackEndSec({
    trimEndSec,
    durationSec: d,
    durationFallbackSec: d > 0 ? d : PLACEHOLDER_TIMELINE_CAP_SEC,
  });
}

/**
 * 分割・ダブルクリック追加など: 実尺が 0 のときだけプレースホルダ上限をフォールバックに使い clamp する。
 */
export function clampTimelineHeadForCueOps(
  t: number,
  trimStartSec: number,
  trimEndSec: number | null,
  durationSec: number
): number {
  const fallback =
    durationSec > 0 ? durationSec : PLACEHOLDER_TIMELINE_CAP_SEC;
  return clampSeekTimeSec({
    t,
    trimStartSec,
    trimEndSec,
    durationSec,
    durationFallbackSec: fallback,
  });
}

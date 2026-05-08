/**
 * ② タイムライン制御（キュー区間・ギャップ・ジャンプの単一窓口へ集約していく）
 *
 * 当面: `lib/cueInterval` を再エクスポートし、import を `core/timelineController` に寄せる。
 * 再生ヘッド・トリムまわりの純関数は `playbackTrim` から再エクスポート（UI はここ経由で import 可）。
 * キュー編集用の境界秒は `trimHiSecForCueTimeline` / `clampTimelineHeadForCueOps`。
 * 移行後: 「現在の cue 判定」「ジャンプ」などをここに実装し、UI はイベント発火のみにする。
 */
export * from "../lib/cueInterval";

export type { ClampSeekTimeParams, CanSplitCueAtTimeParams } from "./playbackTrim";
export {
  clampSeekTimeSec,
  clampTimelineHeadForCueOps,
  canSplitCueAtTime,
  effectiveDurationCapSec,
  isPlaybackBeforeTrimStart,
  isPlaybackPastTrimEnd,
  PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS,
  roundPlaybackHeadSec,
  trimHiSecForCueTimeline,
  trimPlaybackEndSec,
} from "./playbackTrim";

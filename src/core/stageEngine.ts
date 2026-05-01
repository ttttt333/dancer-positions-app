/**
 * ③ ステージ計算（UI から独立した純ロジックをここへ集約していく）
 *
 * 当面: `lib/` の実装を再エクスポートし、import パスを `core/stageEngine` に寄せる。
 * 移行後: 補間・フォーメーション解決を本ファイル直下（または分割モジュール）へ移す。
 */
export { dancersAtTime } from "../lib/interpolatePlayback";

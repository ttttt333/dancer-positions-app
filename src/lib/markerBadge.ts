/** ○内（名前を○の下のとき）の保存上限。数字のみは距離ラベル用に 4 桁まで許可 */
const MARKER_BADGE_MAX_NON_DIGIT = 3;
const MARKER_BADGE_MAX_DIGIT = 4;

/**
 * 正規化・保存用に丸の内文字列を切り詰める。
 * 空文字は「意図的な空欄」としてそのまま返す（`normalizeDancerSpot` 専用）。
 */
export function sliceMarkerBadgeForStorage(mbRaw: unknown): string | undefined {
  if (mbRaw === "") return "";
  const s =
    typeof mbRaw === "number" && Number.isFinite(mbRaw)
      ? String(Math.round(mbRaw))
      : typeof mbRaw === "string"
        ? mbRaw.trim()
        : "";
  if (!s) return undefined;
  return /^\d+$/.test(s)
    ? s.slice(0, MARKER_BADGE_MAX_DIGIT)
    : s.slice(0, MARKER_BADGE_MAX_NON_DIGIT);
}

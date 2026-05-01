const HANAMICHI_DEPTH_PCT_MIN = 8;
const HANAMICHI_DEPTH_PCT_MAX = 36;
const HANAMICHI_DEPTH_PCT_DEFAULT = 14;

/** 花道の奥行き %（UI スライダーと同じ 8〜36、未指定は 14） */
export function clampHanamichiDepthPct(
  raw: number | null | undefined
): number {
  return Math.min(
    HANAMICHI_DEPTH_PCT_MAX,
    Math.max(HANAMICHI_DEPTH_PCT_MIN, raw ?? HANAMICHI_DEPTH_PCT_DEFAULT)
  );
}

/**
 * 舞台上の人間工学・視覚認知に基づいた黄金幾何定数（10m x 10m 舞台基準）
 */
export const GOLDEN_GEOMETRY = {
  /** 行間奥行きピッチ: 約 1.4m 相当 (14%) */
  ROW_GAP_PCT: 14.0,

  /** 同行内横幅ピッチ: 約 1.6m 相当 (16%) */
  COL_GAP_PCT: 16.0,

  /** V字の標準黄金角度 (70°) */
  V_SHAPE_ANGLE_DEG: 70.0,

  /** 逆V字 / 傘 (Wedge) の標準展開角 (110°) */
  WEDGE_ANGLE_DEG: 110.0,

  /** 扇形・弧の標準半径 (%) */
  ARC_RADIUS_PCT: 35.0,

  /** センター軸認識の許容誤差 (%) */
  CENTER_AXIS_TOLERANCE: 5.0,
} as const;

export type GoldenGeometry = typeof GOLDEN_GEOMETRY;

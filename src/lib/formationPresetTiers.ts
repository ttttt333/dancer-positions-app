import type { LayoutPresetId } from "./formationLayouts";

/** 1=定番 / 2=よく使う派生 / 3=マニアック・演出向け */
export type PresetTier = 1 | 2 | 3;

/** 雛形ピッカー等のデフォルト表示上限（Tier1+2） */
export const DEFAULT_UI_PRESET_MAX_TIER: PresetTier = 2;

/**
 * 実務頻度ベースの Tier 定義。
 * 未登録 id は Tier3 扱い（安全側）。
 */
export const PRESET_TIER_BY_ID: Record<string, PresetTier> = {
  // ── Tier 1: 定番（毎日使う） ─────────────────────────────
  line: 1,
  pyramid: 1,
  pyramid_inverse: 1,
  stagger: 1,
  stagger_inverse: 1,
  two_rows: 1,
  rows_3: 1,
  rows_4: 1,
  rows_5: 1,
  vee: 1,
  inverse_vee: 1,
  line_front: 1,
  line_back: 1,
  line_vertical: 1,
  grid: 1,
  arc: 1,
  circle: 1,
  block_lr: 1,
  block_3: 1,
  front_stair_from_2: 1,
  front_stair_from_3: 1,
  front_stair_from_4: 1,
  diagonal_se: 1,
  diagonal_ne: 1,

  // ── Tier 2: 実務でよく使う派生 ───────────────────────────
  rows_6: 2,
  rows_7: 2,
  rows_8: 2,
  rows_9: 2,
  stagger_3: 2,
  stagger_4: 2,
  stagger_5: 2,
  stagger_wide: 2,
  stagger_tight: 2,
  offset_triple: 2,
  two_rows_dense_back: 2,
  two_rows_equal: 2,
  three_rows_equal: 2,
  front_stair_from_5: 2,
  front_stair_from_6: 2,
  front_stair_from_7: 2,
  front_stair_from_8: 2,
  front_stair_from_9: 2,
  front_stair_from_10: 2,
  front_stair_from_11: 2,
  stairs_diag: 2,
  zigzag: 2,
  line_left: 2,
  line_right: 2,
  diagonal_sw: 2,
  diagonal_nw: 2,
  columns_3: 2,
  columns_4: 2,
  columns_5: 2,
  columns_6: 2,
  columns_7: 2,
  columns_8: 2,
  column_pair: 2,
  grid_tight: 2,
  grid_wide: 2,
  brick_pattern: 2,
  checkerboard: 2,
  wedge: 2,
  fan_back: 2,
  fan_front: 2,
  fan_wide: 2,
  v_open: 2,
  v_tight: 2,
  triple_vee: 2,
  arrow_back: 2,
  arrow_front: 2,
  hourglass: 2,
  arc_tight: 2,
  arc_front: 2,
  double_arc: 2,
  semicircle_back: 2,
  ellipse: 2,
  u_shape: 2,
  hollow_ring: 2,
  concentric: 2,
  block_3_depth: 2,
  block_4: 2,
  block_lr_depth: 2,
  three_clusters: 2,
  wing_spread: 2,
  cross_split: 2,
  quad_corners: 2,
  two_wings: 2,
  three_lines_depth: 2,
  pentagon_group: 2,
  hex_group: 2,
  center_ring_outer: 2,
  diamond: 2,
  square_outline: 2,
  cross: 2,
  x_shape: 2,
  triangle: 2,
  t_shape: 2,
  l_shape: 2,
  cluster_tight: 2,
  wave: 2,
  bowtie: 2,
  arrow_left: 2,
  arrow_right: 2,
  // 追加 Vol.2 の実用系
  extra_line_mid: 2,
  extra_line_high: 2,
  extra_line_low: 2,
  extra_three_lines: 2,
  extra_four_lines: 2,
  extra_five_lines: 2,
  extra_chevron_left: 2,
  extra_chevron_right: 2,
  extra_chevron_wide: 2,
  extra_chevron_tight: 2,
  extra_pyramid_wide: 2,
  extra_pyramid_narrow: 2,
  extra_pyramid_deep: 2,
  extra_horseshoe: 2,
  extra_horseshoe_tight: 2,
  extra_c_shape: 2,
  extra_c_shape_open: 2,
  extra_triple_line_front: 2,
  extra_triple_line_back: 2,
  extra_runway: 2,
  extra_block_front: 2,
  extra_block_back: 2,
  extra_block_center: 2,
  extra_parallel_3: 2,
  extra_parallel_4: 2,
  extra_v_double: 2,
  extra_arc_wide: 2,
  extra_arc_deep: 2,
  extra_arc_left: 2,
  extra_arc_right: 2,
  extra_diamond_wide: 2,
  extra_diamond_tall: 2,
  extra_nested_square: 2,
  extra_nested_square_tight: 2,
  extra_fan_half_left: 2,
  extra_fan_half_right: 2,
  extra_stagger_6: 2,
  extra_stagger_7: 2,
  extra_stair_inv_3: 2,
  extra_stair_inv_4: 2,

  // ── Tier 3: マニアック・極端列数・演出向け ─────────────────
  rows_10: 3,
  rows_11: 3,
  rows_12: 3,
  columns_9: 3,
  columns_10: 3,
  columns_11: 3,
  columns_12: 3,
  cross_diag: 3,
  double_diagonal: 3,
  zigzag_deep: 3,
  zigzag_wide: 3,
  double_ring: 3,
  triple_arc: 3,
  oval_wide: 3,
  oval_tall: 3,
  ring_inner_dot: 3,
  double_ring_offset: 3,
  pentagon: 3,
  hexagon: 3,
  octagon: 3,
  star_5: 3,
  star_6: 3,
  plus_cross: 3,
  double_cross: 3,
  scatter: 3,
  spiral: 3,
  spread_loose: 3,
  asymmetric_l: 3,
  asymmetric_r: 3,
  spiral_loose: 3,
  spiral_tight: 3,
  wave_double: 3,
  sine_deep: 3,
  scatter_wide: 3,
  scatter_center: 3,
  pinwheel: 3,
  radial_burst: 3,
  figure_eight: 3,
  heart: 3,
  comb: 3,
  bracket_lr: 3,
  two_diag_lines: 3,
  s_curve: 3,
  u_deep: 3,
  w_shape: 3,
  m_shape: 3,
  fan_360: 3,
  extra_rows_13: 3,
  extra_rows_14: 3,
  extra_rows_15: 3,
  extra_scatter_tight: 3,
  extra_star_4: 3,
  extra_star_8: 3,
  extra_runway_wide: 3,
  extra_wings_only: 3,
  extra_center_surround: 3,
  extra_diagonal_cross: 3,
};

export function getPresetTier(id: string): PresetTier {
  return PRESET_TIER_BY_ID[id] ?? 3;
}

export function presetTierAtMost(id: string, maxTier: PresetTier): boolean {
  return getPresetTier(id) <= maxTier;
}

export type PresetCategoryDef = { label: string; ids: LayoutPresetId[] };

/** カテゴリから maxTier 以下の id だけ残す（空カテゴリは除去） */
export function filterPresetCategories(
  categories: PresetCategoryDef[],
  maxTier: PresetTier
): PresetCategoryDef[] {
  return categories
    .map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => presetTierAtMost(id, maxTier)),
    }))
    .filter((cat) => cat.ids.length > 0);
}

/** UI デフォルト用カテゴリ（Tier1+2）— `PRESET_CATEGORIES` を渡して使う */
export function presetCategoriesForUi(
  categories: PresetCategoryDef[],
  maxTier: PresetTier = DEFAULT_UI_PRESET_MAX_TIER
): PresetCategoryDef[] {
  return filterPresetCategories(categories, maxTier);
}

/** クイックバー用: Tier1 のみ */
export function quickBarPresetIdsFrom(categories: PresetCategoryDef[]): LayoutPresetId[] {
  const ids: LayoutPresetId[] = [];
  for (const cat of categories) {
    for (const id of cat.ids) {
      if (getPresetTier(id) === 1) ids.push(id);
    }
  }
  return ids;
}

export function countPresetsAboveTierFrom(
  categories: PresetCategoryDef[],
  maxTier: PresetTier
): number {
  let n = 0;
  for (const cat of categories) {
    for (const id of cat.ids) {
      if (getPresetTier(id) > maxTier) n += 1;
    }
  }
  return n;
}

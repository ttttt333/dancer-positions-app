/**
 * 照明連動 AI 提案 ↔ エディタ雛形（約200種）
 * 隊形の中身は dancersForLayoutPreset の幾何を使い、人は id で引き継ぐ。
 */

import {
  ALL_LAYOUT_PRESET_IDS,
  LAYOUT_PRESET_LABELS,
  dancersForLayoutPreset,
  transferDancerIdentitiesByNearestPosition,
  type LayoutPresetId,
} from "../../formationLayouts";
import { getPresetTier } from "../../formationPresetTiers";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../types";
import type {
  ClassProfile,
  FormationPatternId,
  MemberPosition,
  PoseLevel,
  SectionType,
} from "./types";
import type { SuggestTasteBias } from "./suggestTaste";

const VALID = new Set<string>(ALL_LAYOUT_PRESET_IDS);

const CROSS_LAYOUTS = new Set<string>([
  "x_shape",
  "cross",
  "cross_split",
  "cross_diag",
  "double_diagonal",
  "double_cross",
  "two_diag_lines",
  "plus_cross",
  "extra_diagonal_cross",
]);

const FAMILY_LAYOUTS: Record<FormationPatternId, string[]> = {
  center_condensed: [
    "cluster_tight",
    "scatter_center",
    "pyramid",
    "concentric",
    "ring_inner_dot",
    "extra_block_center",
    "extra_center_surround",
  ],
  silhouette_line: [
    "line",
    "line_back",
    "line_front",
    "line_vertical",
    "extra_line_mid",
    "extra_line_high",
    "extra_line_low",
  ],
  split_lr: [
    "block_lr",
    "bracket_lr",
    "wing_spread",
    "two_wings",
    "block_lr_depth",
    "extra_wings_only",
  ],
  small_groups: [
    "block_3",
    "three_clusters",
    "block_3_depth",
    "block_4",
    "extra_block_front",
    "extra_block_back",
  ],
  vee: [
    "vee",
    "inverse_vee",
    "wedge",
    "v_open",
    "v_tight",
    "triple_vee",
    "extra_v_double",
    "extra_chevron_wide",
  ],
  double_u: [
    "w_shape",
    "u_shape",
    "u_deep",
    "m_shape",
    "extra_horseshoe",
    "extra_c_shape",
  ],
  wide_spread: [
    "line_front",
    "spread_loose",
    "arc",
    "fan_front",
    "fan_wide",
    "extra_arc_wide",
  ],
  fast_shift: [
    "two_rows",
    "stagger",
    "line_front",
    "line_back",
    "three_lines_depth",
    "extra_three_lines",
  ],
  circle: [
    "circle",
    "hollow_ring",
    "double_ring",
    "arc",
    "concentric",
    "ellipse",
    "oval_wide",
    "fan_360",
    "extra_horseshoe",
  ],
  dynamic_cross: [
    "x_shape",
    "cross",
    "cross_split",
    "cross_diag",
    "double_diagonal",
    "radial_burst",
    "pinwheel",
    "extra_diagonal_cross",
  ],
  front_asymmetry: [
    "asymmetric_l",
    "asymmetric_r",
    "scatter",
    "comb",
    "l_shape",
    "t_shape",
    "extra_fan_half_left",
    "extra_fan_half_right",
  ],
};

const SECTION_LAYOUTS: Record<SectionType, string[]> = {
  intro: ["line_back", "cluster_tight", "pyramid", "line", "extra_block_back"],
  verse: [
    "two_rows",
    "stagger",
    "grid",
    "arc",
    "block_lr",
    "pyramid",
    "extra_three_lines",
  ],
  chorus: [
    "vee",
    "circle",
    "diamond",
    "fan_front",
    "wing_spread",
    "hourglass",
    "w_shape",
    "extra_v_double",
  ],
  drop: [
    "x_shape",
    "radial_burst",
    "pinwheel",
    "scatter_wide",
    "star_5",
    "extra_star_8",
  ],
  se_trigger: [
    "cross_split",
    "figure_eight",
    "spiral",
    "arrow_front",
    "extra_runway",
  ],
  outro: [
    "arc",
    "line_front",
    "front_stair_from_2",
    "asymmetric_l",
    "heart",
    "extra_arc_deep",
  ],
};

const STYLE_LAYOUTS: Record<string, string[]> = {
  dynamic: [
    "vee",
    "v_open",
    "wing_spread",
    "scatter_wide",
    "radial_burst",
    "x_shape",
    "fan_wide",
  ],
  symmetric: [
    "vee",
    "diamond",
    "circle",
    "pyramid",
    "two_rows",
    "hourglass",
    "bowtie",
  ],
  freestyle: [
    "scatter",
    "spiral",
    "asymmetric_l",
    "pinwheel",
    "heart",
    "figure_eight",
    "star_5",
  ],
  wave: [
    "wave",
    "wave_double",
    "sine_deep",
    "s_curve",
    "arc",
    "spiral",
    "extra_arc_wide",
  ],
};

function onlyValid(ids: string[]): LayoutPresetId[] {
  const out: LayoutPresetId[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!VALID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as LayoutPresetId);
  }
  return out;
}

function layoutFitsCount(id: string, n: number): boolean {
  const rows = id.match(/(?:^|_)rows_(\d+)$/);
  if (rows) return n >= Number(rows[1]);
  const cols = id.match(/columns_(\d+)$/);
  if (cols) return n >= Number(cols[1]);
  const stair = id.match(/front_stair_from_(\d+)$/);
  if (stair) return n >= Number(stair[1]);
  const stagger = id.match(/stagger_(\d+)$/);
  if (stagger) return n >= Number(stagger[1]);
  return true;
}

function metersToPct(x: number, y: number): { xPct: number; yPct: number } {
  return {
    xPct: Math.min(95, Math.max(5, ((x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100)),
    yPct: Math.min(92, Math.max(8, ((y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100)),
  };
}

function pctToMeters(xPct: number, yPct: number): { x: number; y: number } {
  return {
    x: (xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2,
    y: (yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2,
  };
}

function snap(v: number, mode: ClassProfile["gridSnapMode"]): number {
  if (mode === "integer") return Math.round(v);
  return Math.round(v * 20) / 20;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function tierFiller(maxTier: 1 | 2 | 3): string[] {
  return ALL_LAYOUT_PRESET_IDS.filter((id) => getPresetTier(id) <= maxTier);
}

export type PickLayoutPresetInput = {
  family: FormationPatternId;
  sectionType: SectionType;
  salt: number;
  dancerCount: number;
  allowCross: boolean;
  taste?: SuggestTasteBias;
  recent?: LayoutPresetId[];
};

export function pickLayoutPreset(input: PickLayoutPresetInput): LayoutPresetId {
  const n = input.dancerCount;
  const styleId = input.taste?.style;
  const preferFamilies = input.taste?.preferPatterns ?? [];
  const fromFamilies = preferFamilies.flatMap(
    (p) => FAMILY_LAYOUTS[p] ?? []
  );
  const maxTier: 1 | 2 | 3 =
    styleId === "freestyle" || (input.taste?.energyWeight ?? 0) >= 0.35
      ? 3
      : 2;

  const ranked = onlyValid([
    ...fromFamilies,
    ...(FAMILY_LAYOUTS[input.family] ?? []),
    ...(SECTION_LAYOUTS[input.sectionType] ?? []),
    ...(styleId ? STYLE_LAYOUTS[styleId] ?? [] : []),
    ...tierFiller(maxTier),
  ]).filter((id) => layoutFitsCount(id, n));

  let pool = ranked;
  if (!input.allowCross) {
    const noCross = pool.filter((id) => !CROSS_LAYOUTS.has(id));
    if (noCross.length) pool = noCross;
  }
  const avoid = new Set(input.recent ?? []);
  const fresh = pool.filter((id) => !avoid.has(id));
  if (fresh.length) pool = fresh;
  if (pool.length === 0) pool = onlyValid(["line", "two_rows", "vee", "circle"]);

  const window = pool.slice(0, Math.min(24, pool.length));
  return window[Math.abs(input.salt) % window.length]!;
}

export function layoutPresetLabel(id: LayoutPresetId): string {
  return LAYOUT_PRESET_LABELS[id] ?? id;
}

export function buildLayoutMemberPositions(
  presetId: LayoutPresetId,
  memberIds: string[],
  profile: ClassProfile,
  prev: MemberPosition[] | null
): MemberPosition[] {
  const n = memberIds.length;
  if (n <= 0) return [];
  const raw = dancersForLayoutPreset(n, presetId);
  if (raw.length === 0) return [];

  let labeled = raw;
  if (prev && prev.length > 0) {
    const prevSpots = prev.map((p, i) => {
      const pct = metersToPct(p.x, p.y);
      return {
        id: p.memberId,
        label: String(i + 1),
        xPct: pct.xPct,
        yPct: pct.yPct,
        colorIndex: i % 12,
      };
    });
    labeled = transferDancerIdentitiesByNearestPosition(raw, prevSpots);
  } else {
    labeled = raw.map((spot, i) => ({
      ...spot,
      id: memberIds[i] ?? spot.id,
    }));
  }

  const poseById = new Map<string, PoseLevel>();
  for (const p of prev ?? []) poseById.set(p.memberId, p.poseLevel);

  const used = new Set(labeled.map((s) => s.id));
  const missing = memberIds.filter((id) => !used.has(id));
  if (missing.length) {
    labeled = labeled.map((spot, i) =>
      memberIds.includes(spot.id)
        ? spot
        : { ...spot, id: missing.shift() ?? memberIds[i] ?? spot.id }
    );
  }

  return labeled.map((spot) => {
    const m = pctToMeters(spot.xPct, spot.yPct);
    return {
      memberId: spot.id,
      x: snap(clamp(m.x, -5.5, 5.5), profile.gridSnapMode),
      y: snap(clamp(m.y, -3.2, 3.2), profile.gridSnapMode),
      poseLevel: poseById.get(spot.id) ?? "stand",
    };
  });
}

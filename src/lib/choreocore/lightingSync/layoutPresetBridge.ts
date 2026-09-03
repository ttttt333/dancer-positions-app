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
  type LayoutPresetOptions,
} from "../../formationLayouts";
import type { DancerSpot } from "../../types/choreography";
import { getPresetTier } from "../../formationPresetTiers";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../types";
import type { FormationCueAction } from "../engine/types/CueTypes";
import type { FormationType } from "../engine/types/FormationTypes";
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
  intro: ["line_back", "pyramid", "line", "cluster_tight", "two_rows"],
  verse: [
    "two_rows",
    "stagger",
    "line",
    "pyramid",
    "grid",
    "block_lr",
    "line_back",
  ],
  chorus: [
    "vee",
    "diamond",
    "fan_front",
    "inverse_vee",
    "wing_spread",
    "w_shape",
    "pyramid_inverse",
  ],
  drop: ["vee", "fan_wide", "wing_spread", "diamond", "v_open"],
  se_trigger: ["v_tight", "wedge", "wing_spread", "two_rows", "fan_back"],
  outro: ["line_front", "arc", "two_rows", "pyramid", "line"],
};

const STYLE_LAYOUTS: Record<string, string[]> = {
  dynamic: ["vee", "v_open", "wing_spread", "fan_wide", "diamond"],
  symmetric: [
    "vee",
    "diamond",
    "circle",
    "pyramid",
    "two_rows",
    "hourglass",
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
  wave: ["wave", "wave_double", "sine_deep", "s_curve", "arc"],
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

const STAPLE_LAYOUTS: LayoutPresetId[] = [
  "line",
  "two_rows",
  "vee",
  "circle",
  "pyramid",
  "arc",
  "diamond",
  "wing_spread",
];

export function isCrossLayoutPreset(id: string): boolean {
  return CROSS_LAYOUTS.has(id);
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

function isPracticalLayout(id: string, style?: string): boolean {
  if (style === "freestyle") return true;
  if (style === "wave" && /wave|arc|sine|s_curve/.test(id)) return true;
  if (/^extra_/.test(id)) return false;
  if (
    /scatter|pinwheel|heart|spiral|star_|figure_eight|radial|bowtie|concentric|ring_inner|runway|horseshoe|asymmetric/.test(
      id
    )
  ) {
    return false;
  }
  return getPresetTier(id) <= 2;
}

function rankedLayoutPool(input: PickLayoutPresetInput): LayoutPresetId[] {
  const n = input.dancerCount;
  const styleId = input.taste?.style;
  const preferFamilies = input.taste?.preferPatterns ?? [];
  const fromFamilies = preferFamilies.flatMap(
    (p) => FAMILY_LAYOUTS[p] ?? []
  );

  const ranked = onlyValid([
    ...fromFamilies,
    ...(SECTION_LAYOUTS[input.sectionType] ?? []),
    ...(FAMILY_LAYOUTS[input.family] ?? []),
    ...(styleId ? STYLE_LAYOUTS[styleId] ?? [] : []),
    ...STAPLE_LAYOUTS,
  ]).filter((id) => layoutFitsCount(id, n));

  let pool = ranked.filter((id) => isPracticalLayout(id, styleId));
  if (!input.allowCross) {
    const noCross = pool.filter((id) => !CROSS_LAYOUTS.has(id));
    if (noCross.length) pool = noCross;
  }
  const avoid = new Set(input.recent ?? []);
  const fresh = pool.filter((id) => !avoid.has(id));
  if (fresh.length) pool = fresh;
  if (pool.length === 0) pool = onlyValid(["line", "two_rows", "vee", "circle"]);
  return pool;
}

export function pickLayoutPreset(input: PickLayoutPresetInput): LayoutPresetId {
  const pool = rankedLayoutPool(input);
  const window = pool.slice(0, Math.min(8, pool.length));
  return window[Math.abs(input.salt) % window.length]!;
}

/** 曲の意図に合うエディタ雛形を、スコア順に複数返す */
export function rankLayoutPresets(
  input: PickLayoutPresetInput,
  limit = 8
): LayoutPresetId[] {
  const n = input.dancerCount;
  const primary = rankedLayoutPool(input);
  const staples = STAPLE_LAYOUTS.filter((id) => {
    if (!layoutFitsCount(id, n)) return false;
    if (!input.allowCross && CROSS_LAYOUTS.has(id)) return false;
    return true;
  });
  return onlyValid([...primary, ...staples]).slice(0, Math.max(1, limit));
}

export function familyForCueAction(
  action: FormationCueAction,
  section: SectionType
): FormationPatternId {
  switch (action) {
    case "EXPAND":
      return "wide_spread";
    case "CONTRACT":
    case "CLUSTER":
    case "MERGE":
    case "CENTER":
      return "center_condensed";
    case "SPLIT":
      return "split_lr";
    case "LINE":
      return "silhouette_line";
    case "DIAGONAL":
      return section === "drop" ? "dynamic_cross" : "front_asymmetry";
    case "V":
    case "TRIANGLE":
      return "vee";
    case "ARC":
      return "circle";
    case "MAJOR_CHANGE":
      if (section === "chorus") return "vee";
      if (section === "drop") return "vee";
      if (section === "outro") return "silhouette_line";
      if (section === "se_trigger") return "vee";
      return "fast_shift";
    case "HOLD":
    case "MICRO_SHIFT":
    default:
      return "fast_shift";
  }
}

/** エディタ雛形 id → 曲理解エンジンの FormationType（採点用） */
export function engineTypeForLayoutPreset(id: string): FormationType {
  if (/(?:^|_)(?:vee|v_open|v_tight|wedge|triple_vee)/.test(id)) return "V";
  if (/chevron|inverse_vee|w_shape|m_shape/.test(id)) return "WIDE_V";
  if (/pyramid/.test(id)) return "PYRAMID";
  if (/triangle/.test(id)) return "TRIANGLE";
  if (/diamond|hourglass|bowtie/.test(id)) return "DIAMOND";
  if (/arrow/.test(id)) return "ARROW";
  if (/cluster|scatter_center|block_center|concentric/.test(id)) return "CLUSTER";
  if (/circle|ring|ellipse|oval/.test(id)) return "ARC";
  if (/arc|fan/.test(id)) return "ARC";
  if (/x_shape|cross|diagonal/.test(id)) return "DIAGONAL";
  if (/grid|columns_|rows_/.test(id)) return "GRID";
  if (/two_rows|three_lines|stagger/.test(id)) return "DOUBLE_LINE";
  if (/split|wing|block_lr|bracket/.test(id)) return "SPLIT";
  if (/center/.test(id)) return "CENTER";
  if (/line/.test(id)) return "LINE";
  return "CUSTOM";
}

export function layoutPresetIdFromTags(
  tags: string[] | undefined
): LayoutPresetId | null {
  const raw = tags?.find((t) => t.startsWith("layout:"))?.slice("layout:".length);
  if (!raw || !VALID.has(raw)) return null;
  return raw as LayoutPresetId;
}

/**
 * 雛形の幾何に、既存の人を近い位置で載せる。戻りは seed と同じ順・同じ id。
 */
export function spotsForLayoutPreset(
  presetId: LayoutPresetId,
  seeds: DancerSpot[],
  identityFrom: DancerSpot[],
  layoutOpts?: LayoutPresetOptions
): DancerSpot[] {
  if (seeds.length === 0) return [];
  const raw = dancersForLayoutPreset(seeds.length, presetId, layoutOpts);
  if (raw.length === 0) return seeds.map((s) => ({ ...s }));
  const source = identityFrom.length > 0 ? identityFrom : seeds;
  const labeled = transferDancerIdentitiesByNearestPosition(raw, source);
  const byId = new Map(labeled.map((d) => [d.id, d] as const));
  return seeds.map((seed) => {
    const hit = byId.get(seed.id);
    if (!hit) return { ...seed };
    return {
      ...seed,
      xPct: hit.xPct,
      yPct: hit.yPct,
      poseLevel: hit.poseLevel ?? seed.poseLevel,
    };
  });
}

export function layoutPresetLabel(id: LayoutPresetId): string {
  return LAYOUT_PRESET_LABELS[id] ?? id;
}

export function buildLayoutMemberPositions(
  presetId: LayoutPresetId,
  memberIds: string[],
  profile: ClassProfile,
  prev: MemberPosition[] | null,
  layoutOpts?: LayoutPresetOptions
): MemberPosition[] {
  const n = memberIds.length;
  if (n <= 0) return [];
  const raw = dancersForLayoutPreset(n, presetId, layoutOpts);
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

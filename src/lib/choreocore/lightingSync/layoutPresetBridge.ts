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
import { orderLayoutsByGoldenPreference } from "../engine/formation/goldenFormationFilter";
import type { SongSectionV2 } from "../types/songStructure";

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
    "pyramid_inverse",
    "grid",
    "stagger",
    "spread_loose",
    "fan_front",
    "diamond",
  ],
  fast_shift: [
    "stagger",
    "two_rows",
    "grid",
    "pyramid",
    "three_lines_depth",
    "block_3",
  ],
  circle: [
    "circle",
    "hollow_ring",
    "double_ring",
    "concentric",
    "ellipse",
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
    "comb",
    "l_shape",
    "t_shape",
    "stagger",
    "extra_fan_half_left",
    "extra_fan_half_right",
  ],
};

const SECTION_LAYOUTS: Record<SectionType, string[]> = {
  intro: ["pyramid", "cluster_tight", "two_rows", "grid", "line_back"],
  verse: [
    "stagger",
    "two_rows",
    "pyramid",
    "grid",
    "three_clusters",
    "block_3",
    "line_vertical",
  ],
  chorus: [
    "pyramid_inverse",
    "diamond",
    "grid",
    "stagger",
    "vee",
    "two_rows",
    "hourglass",
  ],
  drop: ["diamond", "x_shape", "pyramid_inverse", "radial_burst", "v_open"],
  se_trigger: ["cluster_tight", "pyramid", "stagger", "asymmetric_l", "wedge"],
  outro: ["pyramid", "arc", "two_rows", "circle", "grid"],
};

const STYLE_LAYOUTS: Record<string, string[]> = {
  dynamic: [
    "pyramid",
    "stagger",
    "grid",
    "diamond",
    "radial_burst",
    "wedge",
    "pyramid_inverse",
  ],
  symmetric: [
    "pyramid",
    "grid",
    "diamond",
    "circle",
    "two_rows",
    "hourglass",
    "concentric",
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
  "pyramid",
  "stagger",
  "grid",
  "diamond",
  "two_rows",
  "cluster_tight",
  "u_shape",
  "pyramid_inverse",
  "three_clusters",
  "hourglass",
];

/** 連続で横広がりばかりにならないよう抑える */
const HORIZONTAL_WIDE = new Set<string>([
  "line",
  "line_front",
  "line_back",
  "fan_wide",
  "fan_front",
  "fan_back",
  "wing_spread",
  "spread_loose",
  "arc",
  "oval_wide",
  "extra_arc_wide",
]);

/** キュー番号でローテする「見せ場」隊形（後半でも周期が短く潰れないよう長め） */
export const SHOW_VARIETY_CYCLE: LayoutPresetId[] = [
  "pyramid",
  "stagger",
  "grid",
  "diamond",
  "two_rows",
  "cluster_tight",
  "block_3_depth",
  "pyramid_inverse",
  "three_clusters",
  "vee",
  "hourglass",
  "block_3",
  "wedge",
  "inverse_vee",
  "column_pair",
  "arc",
  "block_lr",
  "two_wings",
  "scatter_center",
  "concentric",
  "t_shape",
  "square_outline",
  "line_vertical",
  "block_4",
];

export function isCrossLayoutPreset(id: string): boolean {
  return CROSS_LAYOUTS.has(id);
}

export function isHorizontalWideLayout(id: string): boolean {
  if (HORIZONTAL_WIDE.has(id)) return true;
  if (/^line($|_)/.test(id) && !/vertical|diag/.test(id)) return true;
  if (/fan_wide|wing_spread|spread_loose/.test(id)) return true;
  return false;
}

export type PickLayoutPresetInput = {
  family: FormationPatternId;
  sectionType: SectionType;
  salt: number;
  dancerCount: number;
  allowCross: boolean;
  taste?: SuggestTasteBias;
  recent?: LayoutPresetId[];
  /** キュー通し番号。ピラミッド→千鳥→グリッドのローテに使う */
  cueIndex?: number;
  /** Cue action（CONTRACT / EXPAND / V など）。黄金構造の Intent ボーナスに使う */
  cueAction?: FormationCueAction | string;
  /** song_structure_v2 セクション（モチーフ一貫性・ダイナミクス） */
  songSection?: SongSectionV2;
  /** 直前 Cue 座標（移動ダイナミクス採点） */
  prevSpotsPct?: Array<{ xPct: number; yPct: number }>;
};

/** 連続で同じ「形の系統」にならないためのバケツ */
export function layoutShapeBucket(id: string): string {
  if (isHorizontalWideLayout(id)) return "hline";
  if (/(?:^|_)(?:vee|v_open|v_tight|wedge|chevron)/.test(id)) return "vee";
  if (/stagger|two_rows|three_lines|grid|columns|rows_/.test(id)) return "depth";
  if (/cluster|pyramid|center|concentric|scatter_center|block_3|block_4/.test(id)) {
    return "center";
  }
  if (/circle|ring|oval|ellipse|horseshoe|u_shape|w_shape|m_shape|arc|fan_/.test(id)) {
    return "round";
  }
  if (/diag|cross|x_shape|pinwheel|radial/.test(id)) return "cross";
  if (/diamond|hourglass|bowtie|star_/.test(id)) return "geo";
  if (/asymmetric|l_shape|t_shape|comb|scatter/.test(id)) return "asym";
  if (/block_lr|wing|bracket|split|two_wings/.test(id)) return "split";
  return id;
}

/**
 * AI finalize の格子補正ポリシー。
 * 雛形がすでに持つ幾何（千鳥・斜め・曲線）を二重補正で壊さない。
 */
export function quantizePolicyForLayoutPreset(layoutId: string | null | undefined): {
  enableStaggering: boolean;
  enableSymmetry: boolean;
  enableLattice: boolean;
} {
  if (!layoutId) {
    return {
      enableStaggering: true,
      enableSymmetry: true,
      enableLattice: true,
    };
  }
  // 横広がり分類に入っていても、弧・斜めは格子吸着しない
  if (
    /(?:^|_)(?:arc|oval|circle|ellipse|diamond|vee|v_open|v_tight|wedge|chevron|horseshoe|u_shape)/.test(
      layoutId
    )
  ) {
    return {
      enableStaggering: false,
      enableSymmetry: !/asymmetric/.test(layoutId),
      enableLattice: false,
    };
  }
  const bucket = layoutShapeBucket(layoutId);
  switch (bucket) {
    case "depth":
      // 千鳥・グリッドは雛形側でオフセット済み → 再千鳥しない
      return {
        enableStaggering: false,
        enableSymmetry: true,
        enableLattice: true,
      };
    case "vee":
    case "round":
    case "geo":
      // 斜め・曲線は格子吸着すると被り・角が崩れる
      return {
        enableStaggering: false,
        enableSymmetry: true,
        enableLattice: false,
      };
    case "asym":
    case "cross":
      return {
        enableStaggering: false,
        enableSymmetry: false,
        enableLattice: true,
      };
    case "hline":
      return {
        enableStaggering: false,
        enableSymmetry: true,
        enableLattice: true,
      };
    default:
      return {
        enableStaggering: true,
        enableSymmetry: true,
        enableLattice: true,
      };
  }
}

function isPracticalLayout(id: string, style?: string): boolean {
  if (style === "freestyle") return true;
  if (style === "wave" && /wave|arc|sine|s_curve/.test(id)) return true;
  if (/^extra_/.test(id)) return false;
  if (/heart|spiral|star_|figure_eight|pinwheel|runway|bowtie/.test(id)) {
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
  const varietyBoost: LayoutPresetId[] = [];
  if (input.cueIndex != null && SHOW_VARIETY_CYCLE.length > 0) {
    // salt を混ぜて再提案・後半キューでも同じ周期に落ちないようにする
    const step = 1 + (Math.abs(input.salt) % 5);
    const i =
      (((input.cueIndex * step + Math.abs(input.salt)) %
        SHOW_VARIETY_CYCLE.length) +
        SHOW_VARIETY_CYCLE.length) %
      SHOW_VARIETY_CYCLE.length;
    varietyBoost.push(SHOW_VARIETY_CYCLE[i]!);
    varietyBoost.push(
      SHOW_VARIETY_CYCLE[(i + step) % SHOW_VARIETY_CYCLE.length]!
    );
    varietyBoost.push(
      SHOW_VARIETY_CYCLE[(i + step * 2) % SHOW_VARIETY_CYCLE.length]!
    );
  }

  const ranked = onlyValid([
    ...varietyBoost,
    ...fromFamilies,
    ...(FAMILY_LAYOUTS[input.family] ?? []),
    ...(SECTION_LAYOUTS[input.sectionType] ?? []),
    ...(styleId ? STYLE_LAYOUTS[styleId] ?? [] : []),
    ...STAPLE_LAYOUTS,
  ]).filter((id) => layoutFitsCount(id, n));

  let pool = ranked.filter((id) => isPracticalLayout(id, styleId));
  if (!input.allowCross) {
    const noCross = pool.filter((id) => !CROSS_LAYOUTS.has(id));
    if (noCross.length) pool = noCross;
  }

  // 使った雛形IDは全体で避ける。形の系統は直近だけ見て枯渇を防ぐ
  const used = input.recent ?? [];
  const avoid = new Set(used);
  const recentForBucket = used.slice(-4);
  const recentBuckets = new Set(
    recentForBucket.map((id) => layoutShapeBucket(id))
  );
  const recentHadHLine = recentForBucket.some(isHorizontalWideLayout);

  const preferDepth = pool.filter((id) => {
    if (avoid.has(id)) return false;
    if (recentBuckets.has(layoutShapeBucket(id))) return false;
    if (recentHadHLine && isHorizontalWideLayout(id)) return false;
    return true;
  });
  if (preferDepth.length) {
    pool = preferDepth;
  } else {
    const fresh = pool.filter(
      (id) => !avoid.has(id) && !(recentHadHLine && isHorizontalWideLayout(id))
    );
    if (fresh.length) pool = fresh;
  }

  // 横広がりを後ろへ
  pool = [
    ...pool.filter((id) => !isHorizontalWideLayout(id)),
    ...pool.filter((id) => isHorizontalWideLayout(id)),
  ];

  // Step 3: 黄金の7大構造を前へ、奇抜・散開を後ろへ（Cue action / モチーフも反映）
  pool = orderLayoutsByGoldenPreference(pool, {
    intentPrimary: input.cueAction,
    demoteNonGolden: true,
    section: input.songSection,
    prevSpots: input.prevSpotsPct,
  }) as LayoutPresetId[];

  if (pool.length === 0) {
    pool = onlyValid(["pyramid", "stagger", "grid", "diamond", "two_rows"]);
  }
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
  const cycle = SHOW_VARIETY_CYCLE.filter((id) => {
    if (!layoutFitsCount(id, n)) return false;
    if (!input.allowCross && CROSS_LAYOUTS.has(id)) return false;
    return isPracticalLayout(id, input.taste?.style);
  });
  // 後半キュー向けに候補枠を広げ、未使用の見せ場を末尾にも載せる
  const used = new Set(input.recent ?? []);
  const unusedCycle = cycle.filter((id) => !used.has(id));
  const ranked = onlyValid([...primary, ...unusedCycle, ...staples, ...cycle]);
  const ordered = orderLayoutsByGoldenPreference(ranked, {
    intentPrimary: input.cueAction,
    demoteNonGolden: true,
    section: input.songSection,
    prevSpots: input.prevSpotsPct,
  }) as LayoutPresetId[];
  return ordered.slice(0, Math.max(1, limit));
}

const MAJOR_FAMILIES: Record<SectionType, FormationPatternId[]> = {
  intro: ["center_condensed", "silhouette_line", "small_groups"],
  verse: ["small_groups", "fast_shift", "front_asymmetry", "silhouette_line"],
  chorus: ["vee", "double_u", "wide_spread", "circle", "front_asymmetry"],
  drop: ["dynamic_cross", "vee", "split_lr", "wide_spread"],
  se_trigger: ["front_asymmetry", "center_condensed", "split_lr", "vee"],
  outro: ["silhouette_line", "circle", "center_condensed"],
};

const EXPAND_FAMILIES: Record<SectionType, FormationPatternId[]> = {
  intro: ["wide_spread", "silhouette_line"],
  verse: ["split_lr", "front_asymmetry", "wide_spread"],
  chorus: ["wide_spread", "vee", "double_u", "circle"],
  drop: ["wide_spread", "dynamic_cross", "split_lr"],
  se_trigger: ["split_lr", "front_asymmetry", "vee"],
  outro: ["wide_spread", "circle"],
};

export function familyForCueAction(
  action: FormationCueAction,
  section: SectionType,
  salt = 0
): FormationPatternId {
  const pick = (pool: FormationPatternId[]): FormationPatternId =>
    pool[Math.abs(salt) % pool.length]!;

  switch (action) {
    case "EXPAND":
      return pick(EXPAND_FAMILIES[section] ?? ["wide_spread"]);
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
      return pick(MAJOR_FAMILIES[section] ?? ["fast_shift"]);
    case "HOLD":
    case "MICRO_SHIFT":
    default:
      return pick(
        section === "verse"
          ? ["fast_shift", "small_groups", "silhouette_line"]
          : ["fast_shift", "center_condensed"]
      );
  }
}

/** 理由コード付きで曲の意図ファミリーを決める */
export function familyForSuggestCue(
  action: FormationCueAction,
  section: SectionType,
  reasonCodes: string[] | undefined,
  salt = 0
): FormationPatternId {
  const reasons = reasonCodes ?? [];
  if (
    reasons.includes("TENSION_CONTRACT") ||
    reasons.includes("PROMOTED_VERSE_END") ||
    reasons.includes("PRE_CHORUS")
  ) {
    return "center_condensed";
  }
  if (reasons.includes("OUTRO")) {
    return Math.abs(salt) % 2 === 0 ? "silhouette_line" : "circle";
  }
  if (
    reasons.some((r) => r === "DROP" || r.includes("DROP")) &&
    action === "MAJOR_CHANGE"
  ) {
    return familyForCueAction("MAJOR_CHANGE", "drop", salt);
  }
  return familyForCueAction(action, section, salt);
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

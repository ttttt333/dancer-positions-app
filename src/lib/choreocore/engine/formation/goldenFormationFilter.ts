/**
 * 黄金の7大構造フィルター。
 * エディタ雛形 ID および幾何座標から適合度を判定し、選定スコアを補正する。
 */

import type { Position2D } from "./geometricGridQuantizer";

/**
 * プロのダンス演出で多用される「黄金の7大構造」種別
 */
export type GoldenFamilyType =
  | "HORIZON_LINE"
  | "STAGGERED_GRID"
  | "V_SHAPE"
  | "DIAMOND_BOX"
  | "WING_SPREAD"
  | "TIGHT_CLUSTER"
  | "SINGLE_CENTER_BACK"
  | "UNKNOWN_NON_GOLDEN";

export type LayoutPresetCandidate = {
  id: string;
  name?: string;
  positions?: Position2D[];
  tags?: string[];
};

export type GoldenFilterOptions = {
  /** 7大構造以外の減点（既定: -0.55） */
  nonGoldenPenalty: number;
  /** 非対称の減点（既定: -0.40） */
  asymmetryPenalty: number;
  /** Intent 一致ボーナス（既定: +0.30） */
  intentMatchBonus: number;
};

export const DEFAULT_GOLDEN_FILTER_OPTIONS: GoldenFilterOptions = {
  nonGoldenPenalty: -0.55,
  asymmetryPenalty: -0.4,
  intentMatchBonus: 0.3,
};

/** 雛形 ID → 7大構造（本番選定の主経路） */
const ID_TO_GOLDEN: Array<{ re: RegExp; family: GoldenFamilyType }> = [
  {
    re: /^(?:line|line_front|line_back|extra_line)/,
    family: "HORIZON_LINE",
  },
  {
    re: /stagger|two_rows|three_lines|grid|columns_|rows_/,
    family: "STAGGERED_GRID",
  },
  {
    re: /(?:^|_)(?:vee|v_open|v_tight|wedge|inverse_vee|triple_vee|chevron)/,
    family: "V_SHAPE",
  },
  {
    re: /diamond|square_outline|hourglass|box_frame/,
    family: "DIAMOND_BOX",
  },
  {
    re: /wing_spread|two_wings|block_lr|bracket_lr|fan_front|fan_wide/,
    family: "WING_SPREAD",
  },
  {
    re: /cluster_tight|scatter_center|concentric|pyramid$|extra_block_center/,
    family: "TIGHT_CLUSTER",
  },
  {
    re: /pyramid_inverse|single_front|arrow_front|t_shape/,
    family: "SINGLE_CENTER_BACK",
  },
  // 曲線・弧も現場で使える開いた／閉じた構図として黄金扱い
  {
    re: /^(?:circle|arc|oval)/,
    family: "DIAMOND_BOX",
  },
  {
    re: /u_shape|u_deep|horseshoe/,
    family: "WING_SPREAD",
  },
];

/** 明示的に非ゴールデン（奇抜・散開寄り） */
const NON_GOLDEN_ID =
  /heart|spiral|pinwheel|scatter$|runway|bowtie|figure_eight|star_|asymmetric|comb_|random|chaos|extra_scatter/;

export function classifyLayoutPresetId(layoutId: string): GoldenFamilyType {
  const id = layoutId.toLowerCase();
  if (NON_GOLDEN_ID.test(id)) return "UNKNOWN_NON_GOLDEN";
  for (const rule of ID_TO_GOLDEN) {
    if (rule.re.test(id)) return rule.family;
  }
  return "UNKNOWN_NON_GOLDEN";
}

export function isGoldenLayoutPresetId(layoutId: string): boolean {
  return classifyLayoutPresetId(layoutId) !== "UNKNOWN_NON_GOLDEN";
}

/**
 * 座標群の分布から「7大構造」のいずれかに分類する。
 */
export function classifyPresetFamily(
  positions: Position2D[],
  tags?: string[]
): GoldenFamilyType {
  const count = positions.length;
  if (count === 0) return "UNKNOWN_NON_GOLDEN";

  if (tags && tags.length > 0) {
    const tagStr = tags.join(" ").toLowerCase();
    if (/v[_-]?shape|vee|v字/.test(tagStr)) return "V_SHAPE";
    if (/line|一列|horizon/.test(tagStr)) return "HORIZON_LINE";
    if (/cluster|tight|密集/.test(tagStr)) return "TIGHT_CLUSTER";
    if (/diamond|box|ダイヤ/.test(tagStr)) return "DIAMOND_BOX";
    if (/wing|ウィング/.test(tagStr)) return "WING_SPREAD";
    if (/stagger|千鳥|grid/.test(tagStr)) return "STAGGERED_GRID";
  }

  const yValues = positions.map((p) => Math.round(p.y * 10) / 10);
  const uniqueYCount = new Set(yValues).size;
  const xCoords = positions.map((p) => p.x);
  const xSpan = Math.max(...xCoords) - Math.min(...xCoords);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);
  const minY = Math.min(...yValues);

  if (uniqueYCount === 1 || ySpan < 0.3) return "HORIZON_LINE";
  if (xSpan <= 2.5 && ySpan <= 2.5) return "TIGHT_CLUSTER";
  if (isVShapePattern(positions)) return "V_SHAPE";

  const centerTop = positions.filter(
    (p) => Math.abs(p.x) < 0.3 && Math.round(p.y * 10) / 10 === minY
  );
  if (centerTop.length === 1 && count >= 3 && uniqueYCount >= 2) {
    return "SINGLE_CENTER_BACK";
  }

  if (uniqueYCount >= 3 && isSymmetricBoxPattern(positions)) {
    return "DIAMOND_BOX";
  }

  if (uniqueYCount >= 2 && xSpan > 3.0) {
    // 左右に大きく開いていればウィング、そうでなければ千鳥
    const left = positions.filter((p) => p.x < -0.5).length;
    const right = positions.filter((p) => p.x > 0.5).length;
    const mid = positions.filter((p) => Math.abs(p.x) <= 0.5).length;
    if (left >= 2 && right >= 2 && mid <= Math.ceil(count * 0.35)) {
      return "WING_SPREAD";
    }
    return "STAGGERED_GRID";
  }

  return "UNKNOWN_NON_GOLDEN";
}

/**
 * 雛形の幾何／ID から7大構造適合度とスコア補正を返す。
 */
export function scorePresetAgainstGoldenRules<T extends LayoutPresetCandidate>(
  preset: T,
  targetIntentPrimary?: string,
  options?: Partial<GoldenFilterOptions>
): {
  preset: T;
  familyType: GoldenFamilyType;
  scoreAdjustment: number;
  isGolden: boolean;
} {
  const opts = { ...DEFAULT_GOLDEN_FILTER_OPTIONS, ...options };

  // ID が明示的に非黄金なら幾何で上書きしない
  let familyType: GoldenFamilyType = classifyLayoutPresetId(preset.id);
  const idLooksNonGolden = NON_GOLDEN_ID.test(preset.id.toLowerCase());
  if (
    familyType === "UNKNOWN_NON_GOLDEN" &&
    !idLooksNonGolden &&
    preset.positions &&
    preset.positions.length > 0
  ) {
    familyType = classifyPresetFamily(preset.positions, preset.tags);
  } else if (
    familyType === "UNKNOWN_NON_GOLDEN" &&
    !idLooksNonGolden &&
    preset.tags?.length
  ) {
    const fromTags = classifyPresetFamily(
      preset.positions ?? [{ x: 0, y: 0 }],
      preset.tags
    );
    if (fromTags !== "UNKNOWN_NON_GOLDEN") familyType = fromTags;
  }

  const isGolden = familyType !== "UNKNOWN_NON_GOLDEN";
  const symmetryRatio =
    preset.positions && preset.positions.length > 0
      ? calculateSymmetryRatio(preset.positions)
      : isGolden
        ? 1
        : 0.5;

  let scoreAdjustment = 0;
  if (!isGolden) scoreAdjustment += opts.nonGoldenPenalty;
  if (symmetryRatio < 0.7) scoreAdjustment += opts.asymmetryPenalty;

  if (targetIntentPrimary) {
    const intent = targetIntentPrimary.toUpperCase();
    if (
      (intent === "CONTRACT" || intent === "CLUSTER" || intent === "CENTER") &&
      familyType === "TIGHT_CLUSTER"
    ) {
      scoreAdjustment += opts.intentMatchBonus;
    } else if (
      intent === "EXPAND" &&
      (familyType === "WING_SPREAD" || familyType === "V_SHAPE")
    ) {
      scoreAdjustment += opts.intentMatchBonus;
    } else if (
      (intent === "V" || intent === "TRIANGLE") &&
      familyType === "V_SHAPE"
    ) {
      scoreAdjustment += opts.intentMatchBonus;
    } else if (intent === "LINE" && familyType === "HORIZON_LINE") {
      scoreAdjustment += opts.intentMatchBonus;
    }
  }

  return {
    preset,
    familyType,
    scoreAdjustment: Number(scoreAdjustment.toFixed(3)),
    isGolden,
  };
}

/**
 * 雛形 ID 配列を黄金構造優先で並べ替える。
 * 既定は相対順を保ったまま非ゴールデンだけ末尾へ（見せ場ローテを壊さない）。
 */
export function orderLayoutsByGoldenPreference(
  layoutIds: string[],
  opts?: {
    intentPrimary?: string;
    /** true のとき非ゴールデンを末尾へ落とす（既定 true） */
    demoteNonGolden?: boolean;
    /**
     * "stable" … 黄金同士の相対順を維持（既定）
     * "score" … Intent ボーナス込みで黄金内も並べ替え
     */
    mode?: "stable" | "score";
  }
): string[] {
  const demote = opts?.demoteNonGolden !== false;
  const mode = opts?.mode ?? "stable";

  if (!demote && mode === "stable") return [...layoutIds];

  if (mode === "score") {
    const scored = layoutIds.map((id, index) => {
      const evaled = scorePresetAgainstGoldenRules(
        { id },
        opts?.intentPrimary
      );
      const score = evaled.scoreAdjustment * 100 - index * 0.01;
      return { id, score, isGolden: evaled.isGolden };
    });
    scored.sort((a, b) => {
      if (demote && a.isGolden !== b.isGolden) return a.isGolden ? -1 : 1;
      return b.score - a.score;
    });
    return scored.map((s) => s.id);
  }

  // stable: 黄金を前に、非黄金を後ろに。各グループ内は元順
  const golden: string[] = [];
  const nonGolden: string[] = [];
  for (const id of layoutIds) {
    if (isGoldenLayoutPresetId(id)) golden.push(id);
    else nonGolden.push(id);
  }

  if (!opts?.intentPrimary) {
    return demote ? [...golden, ...nonGolden] : [...layoutIds];
  }

  // Intent 一致を黄金グループの先頭へ（相対順は一致組／非一致組の中で維持）
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const id of golden) {
    const adj = scorePresetAgainstGoldenRules({ id }, opts.intentPrimary)
      .scoreAdjustment;
    if (adj >= DEFAULT_GOLDEN_FILTER_OPTIONS.intentMatchBonus - 1e-6) {
      matched.push(id);
    } else {
      unmatched.push(id);
    }
  }
  return demote
    ? [...matched, ...unmatched, ...nonGolden]
    : [...matched, ...unmatched, ...nonGolden];
}

export function calculateSymmetryRatio(positions: Position2D[]): number {
  if (positions.length <= 1) return 1;

  let symmetricPairs = 0;
  const tolerance = 0.4;
  const used = new Set<number>();

  for (let i = 0; i < positions.length; i += 1) {
    if (used.has(i)) continue;
    const p1 = positions[i]!;
    if (Math.abs(p1.x) < 0.3) {
      symmetricPairs += 1;
      used.add(i);
      continue;
    }
    let found = false;
    for (let j = i + 1; j < positions.length; j += 1) {
      if (used.has(j)) continue;
      const p2 = positions[j]!;
      if (
        Math.abs(p1.y - p2.y) <= tolerance &&
        Math.abs(p1.x + p2.x) <= tolerance
      ) {
        symmetricPairs += 2;
        used.add(i);
        used.add(j);
        found = true;
        break;
      }
    }
    if (!found) {
      // unpaired asymmetric
    }
  }

  return Math.min(1, symmetricPairs / positions.length);
}

function isVShapePattern(positions: Position2D[]): boolean {
  if (positions.length < 3) return false;
  const sortedByY = [...positions].sort((a, b) => a.y - b.y);
  let vCorrelation = 0;
  for (let i = 1; i < sortedByY.length; i += 1) {
    if (Math.abs(sortedByY[i]!.x) >= Math.abs(sortedByY[i - 1]!.x) - 0.05) {
      vCorrelation += 1;
    }
  }
  return vCorrelation / (positions.length - 1) > 0.65;
}

function isSymmetricBoxPattern(positions: Position2D[]): boolean {
  const xCoords = positions.map((p) => Math.abs(p.x));
  const uniqueXCount = new Set(xCoords.map((x) => Math.round(x * 10) / 10)).size;
  return uniqueXCount <= Math.ceil(positions.length / 2);
}

/**
 * AI提案の曲イメージ・スタイル・歌詞を、隊形選びと移動量に落とす。
 * 照明連動エンジン（現行本番経路）向け。
 */

import type { ClassProfile, FormationPatternId } from "./types";
import type { CueLayoutPin } from "./cueLayoutPins";

export const SUGGEST_VIBES = [
  { id: "energetic", label: "⚡ エネルギッシュ", desc: "激しい・パワフル" },
  { id: "emotional", label: "💜 エモーショナル", desc: "感動・叙情的" },
  { id: "cute", label: "🌸 キュート", desc: "かわいい・ポップ" },
  { id: "cool", label: "🌙 クール", desc: "スタイリッシュ・洗練" },
  { id: "mysterious", label: "✨ ミステリアス", desc: "幻想的・神秘的" },
  { id: "upbeat", label: "🎉 アップビート", desc: "明るい・楽しい" },
  { id: "serious", label: "🎭 シリアス", desc: "重厚・ドラマチック" },
  { id: "romantic", label: "🌹 ロマンチック", desc: "甘い・優雅" },
] as const;

export type SuggestVibeId = (typeof SUGGEST_VIBES)[number]["id"];

export const SUGGEST_FORMATION_STYLES = [
  { id: "dynamic", label: "ダイナミック", desc: "大きな移動・変化重視" },
  { id: "symmetric", label: "シンメトリー", desc: "左右対称・整然" },
  { id: "freestyle", label: "フリースタイル", desc: "自由・個性的" },
  { id: "wave", label: "ウェーブ", desc: "流れるような配置" },
] as const;

export type SuggestFormationStyleId =
  (typeof SUGGEST_FORMATION_STYLES)[number]["id"];

export type SuggestTaste = {
  vibes?: SuggestVibeId[];
  style?: SuggestFormationStyleId;
  lyrics?: string;
  note?: string;
};

export type SuggestTasteBias = {
  preferPatterns: FormationPatternId[];
  avoidPatterns: FormationPatternId[];
  /** 再提案で避けたいエディタ雛形 ID（知見の蓄積） */
  avoidLayoutIds?: string[];
  /** 採用した雛形 ID（同系統の再選出を優遇） */
  preferLayoutIds?: string[];
  style?: SuggestFormationStyleId;
  /** サビ/ドロップを残す重み。正で派手、負で均等・静かに */
  energyWeight: number;
  allowCross: boolean | null;
  movementScale: number;
  minCountsDelta: number;
  gridSnap: ClassProfile["gridSnapMode"] | null;
  lyricsHits: string[];
  summary: string;
  /** 知見: OUTRO をキメ隊形寄りに */
  outroClimax?: boolean;
  /** 知見: 平坦 GRID 系を避ける */
  avoidFlatGrid?: boolean;
  /** 「最初／最後はピラミッド」など Cue 位置の強制ピン */
  cueLayoutPins?: CueLayoutPin[];
};

export const PATTERN_LABEL_JA: Record<FormationPatternId, string> = {
  center_condensed: "中央収束",
  silhouette_line: "一列シルエット",
  split_lr: "左右割れ",
  small_groups: "小グループ",
  vee: "V字",
  double_u: "W字",
  wide_spread: "横一列ワイド",
  fast_shift: "前後シフト",
  circle: "円",
  dynamic_cross: "交差",
  front_asymmetry: "手前非対称",
};

const VIBE_PATTERNS: Record<
  SuggestVibeId,
  { prefer: FormationPatternId[]; energy: number }
> = {
  energetic: {
    prefer: ["vee", "wide_spread", "fast_shift", "dynamic_cross"],
    energy: 0.4,
  },
  emotional: {
    prefer: ["silhouette_line", "center_condensed", "front_asymmetry"],
    energy: -0.25,
  },
  cute: {
    prefer: ["small_groups", "circle", "split_lr"],
    energy: 0.1,
  },
  cool: {
    prefer: ["silhouette_line", "split_lr", "wide_spread"],
    energy: 0,
  },
  mysterious: {
    prefer: ["center_condensed", "front_asymmetry", "silhouette_line"],
    energy: -0.15,
  },
  upbeat: {
    prefer: ["vee", "double_u", "circle", "wide_spread"],
    energy: 0.3,
  },
  serious: {
    prefer: ["silhouette_line", "split_lr", "wide_spread"],
    energy: -0.15,
  },
  romantic: {
    prefer: ["center_condensed", "small_groups", "silhouette_line"],
    energy: -0.1,
  },
};

const STYLE_BIAS: Record<
  SuggestFormationStyleId,
  {
    prefer: FormationPatternId[];
    avoid: FormationPatternId[];
    energy: number;
    allowCross: boolean | null;
    movementScale: number;
    minCountsDelta: number;
    gridSnap: ClassProfile["gridSnapMode"] | null;
  }
> = {
  dynamic: {
    prefer: ["wide_spread", "vee", "fast_shift", "dynamic_cross"],
    avoid: ["center_condensed"],
    energy: 0.25,
    allowCross: true,
    movementScale: 1.2,
    minCountsDelta: -1,
    gridSnap: null,
  },
  symmetric: {
    prefer: ["vee", "double_u", "split_lr", "circle", "silhouette_line"],
    avoid: ["front_asymmetry", "small_groups"],
    energy: 0,
    allowCross: false,
    movementScale: 0.9,
    minCountsDelta: 1,
    gridSnap: null,
  },
  freestyle: {
    prefer: ["front_asymmetry", "small_groups", "split_lr", "dynamic_cross"],
    avoid: [],
    energy: 0.1,
    allowCross: true,
    movementScale: 1.1,
    minCountsDelta: 0,
    gridSnap: "free",
  },
  wave: {
    prefer: ["circle", "double_u", "wide_spread", "silhouette_line"],
    avoid: ["dynamic_cross"],
    energy: 0.05,
    allowCross: null,
    movementScale: 1,
    minCountsDelta: 0,
    gridSnap: null,
  },
};

const LYRIC_HINTS: Array<{
  re: RegExp;
  patterns: FormationPatternId[];
  energy: number;
  tag: string;
}> = [
  {
    re: /円|輪|サークル|囲[むみ]|circle|round/i,
    patterns: ["circle"],
    energy: 0,
    tag: "円・輪",
  },
  {
    re: /V字|ブイ|翼|羽|vee|wing/i,
    patterns: ["vee", "wide_spread"],
    energy: 0.15,
    tag: "V字",
  },
  {
    re: /割れ|分か|左右|split/i,
    patterns: ["split_lr"],
    energy: 0,
    tag: "左右",
  },
  {
    re: /集[ままれ]|ひとつ|一緒|together|unity/i,
    patterns: ["center_condensed"],
    energy: -0.1,
    tag: "集合",
  },
  {
    re: /光|輝|咲|開|shine|bloom|light/i,
    patterns: ["wide_spread", "vee"],
    energy: 0.25,
    tag: "開花・光",
  },
  {
    re: /闇|影|夜|静[か]|dark|night|silent/i,
    patterns: ["center_condensed", "silhouette_line"],
    energy: -0.3,
    tag: "闇・静",
  },
  {
    re: /走|跳|飛|踊|回|爆|叫|run|jump|dance|fight/i,
    patterns: ["fast_shift", "dynamic_cross", "circle"],
    energy: 0.45,
    tag: "動き",
  },
  {
    re: /愛|恋|抱|寄[りり]|heart|love|kiss/i,
    patterns: ["small_groups", "center_condensed"],
    energy: 0,
    tag: "愛",
  },
  {
    re: /涙|泣|別[れれ]|cry|goodbye|sad/i,
    patterns: ["silhouette_line", "front_asymmetry"],
    energy: -0.2,
    tag: "叙情",
  },
  {
    re: /波|流[れれる]|wave|flow/i,
    patterns: ["double_u", "wide_spread", "circle"],
    energy: 0.1,
    tag: "波",
  },
];

const VIBE_LABEL = Object.fromEntries(
  SUGGEST_VIBES.map((v) => [v.id, v.label.replace(/^[^\s]+\s/, "")])
) as Record<SuggestVibeId, string>;

const STYLE_LABEL = Object.fromEntries(
  SUGGEST_FORMATION_STYLES.map((s) => [s.id, s.label])
) as Record<SuggestFormationStyleId, string>;

function uniquePatterns(ids: FormationPatternId[]): FormationPatternId[] {
  const seen = new Set<FormationPatternId>();
  const out: FormationPatternId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function scanLyrics(lyrics: string | undefined): {
  patterns: FormationPatternId[];
  energy: number;
  hits: string[];
} {
  const text = lyrics?.trim() ?? "";
  if (!text) return { patterns: [], energy: 0, hits: [] };
  const patterns: FormationPatternId[] = [];
  const hits: string[] = [];
  let energy = 0;
  for (const hint of LYRIC_HINTS) {
    if (!hint.re.test(text)) continue;
    patterns.push(...hint.patterns);
    hits.push(hint.tag);
    energy += hint.energy;
  }
  return { patterns, energy, hits };
}

export function resolveSuggestTaste(taste?: SuggestTaste | null): SuggestTasteBias {
  const vibes = (taste?.vibes ?? []).filter(
    (id, i, arr): id is SuggestVibeId =>
      arr.indexOf(id) === i && id in VIBE_PATTERNS
  );
  const style: SuggestFormationStyleId | undefined =
    taste?.style && taste.style in STYLE_BIAS ? taste.style : undefined;
  const lyrics = scanLyrics(
    [taste?.lyrics, taste?.note].filter(Boolean).join("\n")
  );

  const prefer: FormationPatternId[] = [];
  const avoid: FormationPatternId[] = [];
  let energyWeight = 0;
  let allowCross: boolean | null = null;
  let movementScale = 1;
  let minCountsDelta = 0;
  let gridSnap: ClassProfile["gridSnapMode"] | null = null;

  if (style) {
    const s = STYLE_BIAS[style];
    prefer.push(...s.prefer);
    avoid.push(...s.avoid);
    energyWeight += s.energy;
    allowCross = s.allowCross;
    movementScale = s.movementScale;
    minCountsDelta = s.minCountsDelta;
    gridSnap = s.gridSnap;
  }

  for (const vibe of vibes) {
    const v = VIBE_PATTERNS[vibe];
    prefer.push(...v.prefer);
    energyWeight += v.energy;
  }

  prefer.unshift(...lyrics.patterns);
  energyWeight += lyrics.energy;

  const summaryParts: string[] = [];
  if (vibes.length) {
    summaryParts.push(`イメージ: ${vibes.map((id) => VIBE_LABEL[id]).join("・")}`);
  }
  if (style) summaryParts.push(`スタイル: ${STYLE_LABEL[style]}`);
  if (lyrics.hits.length) {
    summaryParts.push(`歌詞: ${lyrics.hits.slice(0, 4).join("・")}`);
  }
  if (taste?.note?.trim()) {
    summaryParts.push(`メモ: ${taste.note.trim().slice(0, 40)}`);
  }

  return {
    preferPatterns: uniquePatterns(prefer),
    avoidPatterns: uniquePatterns(avoid),
    style,
    energyWeight: Math.max(-0.6, Math.min(1.2, energyWeight)),
    allowCross,
    movementScale,
    minCountsDelta,
    gridSnap,
    lyricsHits: lyrics.hits,
    summary: summaryParts.join(" / "),
  };
}

export function applyTasteToProfile(
  base: ClassProfile,
  bias: SuggestTasteBias
): ClassProfile {
  const next: ClassProfile = { ...base };
  const toddler = base.targetAgeGroup === "toddler";

  if (toddler) {
    next.allowCrossMovement = false;
    next.maxMoveDistancePerCount = Math.min(
      0.45,
      base.maxMoveDistancePerCount * bias.movementScale
    );
  } else {
    if (bias.allowCross === true) next.allowCrossMovement = true;
    if (bias.allowCross === false) next.allowCrossMovement = false;
    next.maxMoveDistancePerCount = Math.round(
      base.maxMoveDistancePerCount * bias.movementScale * 100
    ) / 100;
  }

  next.minCountsBetweenChanges = Math.max(
    2,
    Math.round(base.minCountsBetweenChanges + bias.minCountsDelta)
  );
  if (bias.gridSnap) next.gridSnapMode = bias.gridSnap;
  return next;
}

/** 再提案フィードバックを隊形バイアスへ反映（立ち位置の選びに効かせる） */
export function applyFeedbackToTaste(
  bias: SuggestTasteBias,
  feedback?: {
    preferLessMovement?: boolean;
    preferFewerCrossings?: boolean;
    preferMoreImpact?: boolean;
    note?: string;
  } | null
): SuggestTasteBias {
  if (!feedback) return bias;
  let prefer = [...bias.preferPatterns];
  let avoid = [...bias.avoidPatterns];
  let energyWeight = bias.energyWeight;
  let movementScale = bias.movementScale;
  let allowCross = bias.allowCross;
  let style = bias.style;
  const hits = [...bias.lyricsHits];
  const summaryParts = [bias.summary].filter(Boolean);

  if (feedback.preferMoreImpact) {
    style = "dynamic";
    energyWeight = Math.max(energyWeight, 0.5);
    movementScale = Math.max(movementScale, 1.3);
    prefer = uniquePatterns([
      ...prefer,
      "vee",
      "dynamic_cross",
      "front_asymmetry",
      "wide_spread",
      "double_u",
    ]);
    summaryParts.push("FB:インパクト");
  }
  if (feedback.preferLessMovement) {
    energyWeight = Math.min(energyWeight, -0.1);
    movementScale = Math.min(movementScale, 0.8);
    prefer = uniquePatterns([
      ...prefer,
      "center_condensed",
      "small_groups",
      "fast_shift",
    ]);
    avoid = uniquePatterns([...avoid, "dynamic_cross"]);
    summaryParts.push("FB:移動少なめ");
  }
  if (feedback.preferFewerCrossings) {
    allowCross = false;
    avoid = uniquePatterns([...avoid, "dynamic_cross"]);
    summaryParts.push("FB:交差少なめ");
  }
  if (feedback.note?.trim()) {
    const fromNote = scanLyrics(feedback.note);
    prefer = uniquePatterns([...fromNote.patterns, ...prefer]);
    energyWeight += fromNote.energy;
    hits.push(...fromNote.hits);
    summaryParts.push(`FBメモ:${feedback.note.trim().slice(0, 40)}`);
  }

  return {
    preferPatterns: prefer,
    avoidPatterns: avoid,
    style,
    energyWeight: Math.max(-0.6, Math.min(1.2, energyWeight)),
    allowCross,
    movementScale,
    minCountsDelta: bias.minCountsDelta,
    gridSnap: bias.gridSnap,
    lyricsHits: [...new Set(hits)],
    summary: summaryParts.filter(Boolean).join(" / "),
  };
}

/** 再提案ごとに隊形ローテをずらすソルト */
export function feedbackVarietySalt(feedback?: {
  preferLessMovement?: boolean;
  preferFewerCrossings?: boolean;
  preferMoreImpact?: boolean;
  note?: string;
} | null): number {
  if (!feedback) return 0;
  let s = 0;
  if (feedback.preferLessMovement) s += 17;
  if (feedback.preferFewerCrossings) s += 29;
  if (feedback.preferMoreImpact) s += 43;
  const note = feedback.note?.trim() ?? "";
  for (let i = 0; i < note.length; i += 1) {
    s += note.charCodeAt(i) * (i + 3);
  }
  return s % 997;
}

export function isEmptyTaste(taste?: SuggestTaste | null): boolean {
  if (!taste) return true;
  return (
    !(taste.vibes && taste.vibes.length) &&
    !taste.style &&
    !taste.lyrics?.trim() &&
    !taste.note?.trim()
  );
}

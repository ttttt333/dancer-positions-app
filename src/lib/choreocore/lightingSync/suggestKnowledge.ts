/**
 * 制作者メモ（初回指示）と再提案フィードバックの知見をセッション内で積み上げる。
 * 同じチップを押しても attempt が増え、避けた雛形は次回以降も除外される。
 */

import type { SuggestFeedback } from "../tier1/types";
import type { FormationPatternId } from "./types";
import type { SuggestTasteBias } from "./suggestTaste";
import { applyFeedbackToTaste, feedbackVarietySalt } from "./suggestTaste";
import {
  formatCueLayoutPins,
  parseCueLayoutPins,
  type CueLayoutPin,
} from "./cueLayoutPins";

export type SuggestKnowledge = {
  /** 再提案回数（初回提案後の 1 回目再提案で 1） */
  attempt: number;
  preferPatterns: FormationPatternId[];
  avoidPatterns: FormationPatternId[];
  avoidLayoutIds: string[];
  preferLayoutIds: string[];
  /** 「最初と最後はピラミッド」など Cue 位置の強制ピン */
  cueLayoutPins: CueLayoutPin[];
  flags: {
    preferLessMovement: boolean;
    preferFewerCrossings: boolean;
    preferMoreImpact: boolean;
  };
  notes: string[];
  /** OUTRO 向けのキメ隊形優遇 */
  outroClimax: boolean;
  /** 平坦 GRID / 並列を避ける */
  avoidFlatGrid: boolean;
  summary: string;
};

export function createEmptySuggestKnowledge(): SuggestKnowledge {
  return {
    attempt: 0,
    preferPatterns: [],
    avoidPatterns: [],
    avoidLayoutIds: [],
    preferLayoutIds: [],
    cueLayoutPins: [],
    flags: {
      preferLessMovement: false,
      preferFewerCrossings: false,
      preferMoreImpact: false,
    },
    notes: [],
    outroClimax: false,
    avoidFlatGrid: false,
    summary: "",
  };
}

function uniqueStrings(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function uniquePatterns(ids: FormationPatternId[]): FormationPatternId[] {
  return [...new Set(ids)];
}

/** 自由記述メモから構造的な避け／好みを抽出 */
export function inferKnowledgeFromNote(note: string): Partial<SuggestKnowledge> {
  const n = note.trim();
  if (!n) return {};
  const preferPatterns: FormationPatternId[] = [];
  const avoidPatterns: FormationPatternId[] = [];
  const avoidLayoutIds: string[] = [];
  let outroClimax = false;
  let avoidFlatGrid = false;
  let preferLessMovement = false;
  let preferMoreImpact = false;
  const cueLayoutPins = parseCueLayoutPins(n);

  if (/四角|グリッド|整列|並列|棒立ち|のっぺり|平坦/.test(n)) {
    avoidFlatGrid = true;
    avoidLayoutIds.push(
      "grid",
      "two_rows",
      "columns_3",
      "columns_4",
      "rows_3",
      "rows_4"
    );
    preferPatterns.push("vee", "wide_spread", "double_u");
  }
  if (/ラスト|アウトロ|outro|締め|フィナーレ|キメ/.test(n)) {
    outroClimax = true;
    preferPatterns.push("vee", "circle", "wide_spread");
    avoidFlatGrid = true;
  }
  if (/動か|静止|動かない|移動が少ない|2人|一部だけ/.test(n)) {
    preferMoreImpact = true;
    preferPatterns.push("vee", "dynamic_cross", "wide_spread", "front_asymmetry");
  }
  if (/移動.*(多|激し)|走り|交差/.test(n) && /減ら|控え|少な/.test(n)) {
    preferLessMovement = true;
    avoidPatterns.push("dynamic_cross");
    preferPatterns.push("center_condensed", "small_groups");
  }
  if (/対称|シンメト|鏡/.test(n)) {
    preferPatterns.push("vee", "circle", "silhouette_line");
    avoidPatterns.push("front_asymmetry");
  }
  // セクション限定の指定（「サビはV字」）はグローバル好みにしない（ピンで固定する）
  const sectionScopedLayout =
    /(?:サビ|大サビ|Aメロ|エーメロ|Bメロ|ビーメロ|プレサビ|イントロ|アウトロ).{0,24}(?:V字|ブイ|ピラミッド|千鳥|円|扇|W字|グリッド|ばらけ|ダイヤ|楔)/i.test(
      n
    ) ||
    /(?:V字|ブイ|ピラミッド|千鳥|円|扇|W字|グリッド|ばらけ|ダイヤ|楔).{0,24}(?:サビ|大サビ|Aメロ|Bメロ|プレサビ)/i.test(
      n
    );
  if (!sectionScopedLayout) {
    if (/V字|ブイ|vee/.test(n)) preferPatterns.push("vee");
    if (/扇|弧|アーチ/.test(n)) preferPatterns.push("circle", "double_u");
    if (/密集|コンパクト|寄せ/.test(n)) preferPatterns.push("center_condensed");
    if (/ピラミッド|pyramid/i.test(n)) preferPatterns.push("center_condensed");
  } else {
    // セクション外の一般語だけ拾う
    if (/扇|弧|アーチ/.test(n) && !/(サビ|Aメロ|Bメロ).{0,12}(扇|弧)/.test(n)) {
      preferPatterns.push("circle", "double_u");
    }
    if (/密集|コンパクト|寄せ/.test(n)) preferPatterns.push("center_condensed");
  }

  return {
    preferPatterns,
    avoidPatterns,
    avoidLayoutIds,
    cueLayoutPins,
    outroClimax,
    avoidFlatGrid,
    flags: {
      preferLessMovement,
      preferFewerCrossings: false,
      preferMoreImpact,
    },
  };
}

function mergeCueLayoutPins(
  prev: CueLayoutPin[],
  next: CueLayoutPin[]
): CueLayoutPin[] {
  const map = new Map<CueLayoutPin["slot"], CueLayoutPin>();
  for (const p of prev) map.set(p.slot, p);
  for (const p of next) map.set(p.slot, p); // 新しいメモを優先
  return [...map.values()];
}

const FLAT_GRID_LAYOUTS = [
  "grid",
  "two_rows",
  "columns_3",
  "columns_4",
  "rows_3",
  "rows_4",
  "line",
  "line_front",
  "line_back",
] as const;

function collectCreatorNotes(input: {
  creatorNote?: string | null;
  creatorNotes?: Array<string | null | undefined>;
  feedbackNote?: string | null;
}): string[] {
  const raw = [
    ...(input.creatorNotes ?? []),
    input.creatorNote,
    input.feedbackNote,
  ];
  return uniqueStrings(
    raw.map((n) => n?.trim() ?? "").filter(Boolean)
  );
}

function mergeInferredFromNotes(
  notes: string[]
): Partial<SuggestKnowledge> {
  let preferPatterns: FormationPatternId[] = [];
  let avoidPatterns: FormationPatternId[] = [];
  let avoidLayoutIds: string[] = [];
  let cueLayoutPins: CueLayoutPin[] = [];
  let outroClimax = false;
  let avoidFlatGrid = false;
  let preferLessMovement = false;
  let preferMoreImpact = false;

  for (const note of notes) {
    const part = inferKnowledgeFromNote(note);
    preferPatterns = uniquePatterns([
      ...preferPatterns,
      ...(part.preferPatterns ?? []),
    ]);
    avoidPatterns = uniquePatterns([
      ...avoidPatterns,
      ...(part.avoidPatterns ?? []),
    ]);
    avoidLayoutIds = uniqueStrings([
      ...avoidLayoutIds,
      ...(part.avoidLayoutIds ?? []),
    ]);
    cueLayoutPins = mergeCueLayoutPins(
      cueLayoutPins,
      part.cueLayoutPins ?? []
    );
    outroClimax = outroClimax || !!part.outroClimax;
    avoidFlatGrid = avoidFlatGrid || !!part.avoidFlatGrid;
    preferLessMovement =
      preferLessMovement || !!part.flags?.preferLessMovement;
    preferMoreImpact = preferMoreImpact || !!part.flags?.preferMoreImpact;
  }

  return {
    preferPatterns,
    avoidPatterns,
    avoidLayoutIds,
    cueLayoutPins,
    outroClimax,
    avoidFlatGrid,
    flags: {
      preferLessMovement,
      preferFewerCrossings: false,
      preferMoreImpact,
    },
  };
}

/**
 * 前回知見に今回の制作者メモ／フィードバック／採否をマージする。
 * `isResuggest=false` の初回はリセットしてから制作者メモだけを適用する。
 */
export function accumulateSuggestKnowledge(
  prev: SuggestKnowledge,
  input: {
    feedback?: SuggestFeedback | null;
    /** 初回「その他・AIへの指示」など制作者メモ（フィードバック以外） */
    creatorNote?: string | null;
    creatorNotes?: Array<string | null | undefined>;
    rejectedLayoutIds?: string[];
    acceptedLayoutIds?: string[];
    isResuggest?: boolean;
  }
): SuggestKnowledge {
  const isResuggest = input.isResuggest !== false;
  const base = isResuggest ? prev : createEmptySuggestKnowledge();
  const fb = input.feedback;

  const noteTexts = collectCreatorNotes({
    creatorNote: input.creatorNote,
    creatorNotes: input.creatorNotes,
    feedbackNote: fb?.note,
  });
  // 再提案時は既に蓄積済みのメモも再解釈（初回指示を落とさない）
  const notesToInfer = uniqueStrings([
    ...(isResuggest ? base.notes : []),
    ...noteTexts,
  ]);
  const fromNote = mergeInferredFromNotes(notesToInfer);
  const cueLayoutPins = mergeCueLayoutPins(
    base.cueLayoutPins,
    fromNote.cueLayoutPins ?? []
  );
  const pinnedIds = new Set(cueLayoutPins.map((p) => p.layoutId));

  const flags = {
    preferLessMovement:
      base.flags.preferLessMovement ||
      !!fb?.preferLessMovement ||
      !!fromNote.flags?.preferLessMovement,
    preferFewerCrossings:
      base.flags.preferFewerCrossings || !!fb?.preferFewerCrossings,
    preferMoreImpact:
      base.flags.preferMoreImpact ||
      !!fb?.preferMoreImpact ||
      !!fromNote.flags?.preferMoreImpact,
  };

  const avoidLayoutIds = uniqueStrings([
    ...base.avoidLayoutIds,
    ...(fb?.avoidLayoutIds ?? []),
    ...(input.rejectedLayoutIds ?? []),
    ...(fromNote.avoidLayoutIds ?? []),
    ...(fromNote.avoidFlatGrid || base.avoidFlatGrid
      ? [...FLAT_GRID_LAYOUTS]
      : []),
  ]).filter((id) => !pinnedIds.has(id)); // ピン指定は避けリストから外す

  const preferLayoutIds = uniqueStrings([
    ...base.preferLayoutIds,
    ...(input.acceptedLayoutIds ?? []),
    ...cueLayoutPins.map((p) => p.layoutId),
  ]).filter((id) => !avoidLayoutIds.includes(id));

  const preferPatterns = uniquePatterns([
    ...base.preferPatterns,
    ...(fromNote.preferPatterns ?? []),
  ]);
  const avoidPatterns = uniquePatterns([
    ...base.avoidPatterns,
    ...(fromNote.avoidPatterns ?? []),
  ]);

  const notes = uniqueStrings([
    ...base.notes,
    ...noteTexts,
  ]).slice(-8);

  const attempt = isResuggest ? base.attempt + 1 : 0;

  const outroClimax =
    base.outroClimax || !!fromNote.outroClimax || flags.preferMoreImpact;
  const avoidFlatGrid =
    base.avoidFlatGrid ||
    !!fromNote.avoidFlatGrid ||
    flags.preferMoreImpact ||
    outroClimax;

  const pinSummary = formatCueLayoutPins(cueLayoutPins);
  const summaryParts = [
    attempt > 0 ? `知見#${attempt}` : notes.length ? "初回指示" : "",
    flags.preferLessMovement ? "移動↓" : "",
    flags.preferFewerCrossings ? "交差↓" : "",
    flags.preferMoreImpact ? "インパクト↑" : "",
    pinSummary ? `指定:${pinSummary}` : "",
    avoidLayoutIds.length ? `避け雛形:${avoidLayoutIds.length}` : "",
    preferLayoutIds.length ? `採用雛形:${preferLayoutIds.length}` : "",
    outroClimax ? "OUTROキメ" : "",
    avoidFlatGrid ? "平坦GRID避け" : "",
  ].filter(Boolean);

  return {
    attempt,
    preferPatterns,
    avoidPatterns,
    avoidLayoutIds,
    preferLayoutIds,
    cueLayoutPins,
    flags,
    notes,
    outroClimax,
    avoidFlatGrid,
    summary: summaryParts.join(" · "),
  };
}

/** 知見を味付けバイアスへ反映（avoidLayoutIds も載せる） */
export function applyKnowledgeToTaste(
  bias: SuggestTasteBias,
  knowledge: SuggestKnowledge
): SuggestTasteBias & { avoidLayoutIds: string[]; preferLayoutIds: string[] } {
  const asFeedback: SuggestFeedback = {
    preferLessMovement: knowledge.flags.preferLessMovement,
    preferFewerCrossings: knowledge.flags.preferFewerCrossings,
    preferMoreImpact: knowledge.flags.preferMoreImpact,
    note: knowledge.notes[knowledge.notes.length - 1],
    avoidLayoutIds: knowledge.avoidLayoutIds,
  };
  let next = applyFeedbackToTaste(bias, asFeedback);
  next = {
    ...next,
    preferPatterns: uniquePatterns([
      ...next.preferPatterns,
      ...knowledge.preferPatterns,
    ]),
    avoidPatterns: uniquePatterns([
      ...next.avoidPatterns,
      ...knowledge.avoidPatterns,
    ]),
    summary: [next.summary, knowledge.summary].filter(Boolean).join(" / "),
  };
  return {
    ...next,
    avoidLayoutIds: knowledge.avoidLayoutIds,
    preferLayoutIds: knowledge.preferLayoutIds,
    outroClimax: knowledge.outroClimax,
    avoidFlatGrid: knowledge.avoidFlatGrid,
    cueLayoutPins: knowledge.cueLayoutPins,
  };
}

/** 同じフィードバックでも attempt ごとに別ソルトになり、再提案が必ず動く */
export function knowledgeVarietySalt(
  knowledge: SuggestKnowledge,
  feedback?: SuggestFeedback | null
): number {
  const base = feedbackVarietySalt(feedback);
  const attemptBump = knowledge.attempt * 97;
  const avoidBump = knowledge.avoidLayoutIds.length * 13;
  const preferBump = knowledge.preferLayoutIds.length * 7;
  const pinBump = knowledge.cueLayoutPins.length * 19;
  return (base + attemptBump + avoidBump + preferBump + pinBump) % 9973;
}

/** UI / 結果オブジェクト用のスナップショット */
export function snapshotSuggestKnowledge(knowledge: SuggestKnowledge): {
  attempt: number;
  summary: string;
  avoidLayoutIds: string[];
  preferLayoutIds: string[];
  cueLayoutPins: CueLayoutPin[];
  flags: SuggestKnowledge["flags"];
  notes: string[];
  outroClimax: boolean;
  avoidFlatGrid: boolean;
} {
  return {
    attempt: knowledge.attempt,
    summary: knowledge.summary,
    avoidLayoutIds: [...knowledge.avoidLayoutIds],
    preferLayoutIds: [...knowledge.preferLayoutIds],
    cueLayoutPins: knowledge.cueLayoutPins.map((p) => ({ ...p })),
    flags: { ...knowledge.flags },
    notes: [...knowledge.notes],
    outroClimax: knowledge.outroClimax,
    avoidFlatGrid: knowledge.avoidFlatGrid,
  };
}

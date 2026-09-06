/**
 * 制作者メモ（初回指示・フィードバック）から
 * 「最初／最後はピラミッド」「サビはV字」など Cue 位置ピンを解析する。
 */

export type CueLayoutSlot =
  | "first"
  | "last"
  | "intro"
  | "outro"
  | "chorus"
  | "verse"
  | "pre_chorus";

export type CueLayoutPin = {
  slot: CueLayoutSlot;
  layoutId: string;
  label: string;
};

const LAYOUT_HINTS: Array<{ re: RegExp; id: string; label: string }> = [
  { re: /逆ピラミッド|pyramid[_\s-]?inverse/i, id: "pyramid_inverse", label: "逆ピラミッド" },
  { re: /ピラミッド|pyramid/i, id: "pyramid", label: "ピラミッド" },
  { re: /V字|ブイ字|\bvee\b|ブイ(?!字)/i, id: "vee", label: "V字" },
  { re: /逆V|inverse[_\s-]?vee/i, id: "inverse_vee", label: "逆V字" },
  { re: /ダイヤ(モンド)?|diamond/i, id: "diamond", label: "ダイヤモンド" },
  { re: /千鳥|stagger/i, id: "stagger", label: "千鳥" },
  { re: /扇|arc(?!\w)|大扇/i, id: "arc", label: "扇形" },
  { re: /円|サークル|circle/i, id: "circle", label: "円" },
  { re: /W字|ダブリュー|\bw[_\s-]?shape\b/i, id: "w_shape", label: "W字形" },
  { re: /楔|ウェッジ|wedge/i, id: "wedge", label: "楔" },
  { re: /ばらけ|散ら|ワイド|広がり|開き/i, id: "wide_spread", label: "ワイド" },
  { re: /二列|2列|two[_\s-]?rows/i, id: "two_rows", label: "二列" },
  { re: /グリッド|格子|\bgrid\b/i, id: "grid", label: "グリッド" },
];

const FIRST_RE = /最初|はじめ|先頭|1番目|一番目|イントロ|intro/i;
const LAST_RE = /最後|ラスト|終わり|終盤|アウトロ|outro|フィナーレ/i;
const CHORUS_RE = /サビ|大サビ|chorus/i;
const VERSE_RE = /Aメロ|エーメロ|ヴァース|verse(?!\s*end)/i;
const PRE_CHORUS_RE = /Bメロ|ビーメロ|プレサビ|pre[_\s-]?chorus/i;

function findLayoutsInText(text: string): Array<{ id: string; label: string }> {
  const hits: Array<{ id: string; label: string }> = [];
  for (const hint of LAYOUT_HINTS) {
    if (hint.re.test(text)) hits.push({ id: hint.id, label: hint.label });
  }
  return hits;
}

function upsertPin(
  pins: CueLayoutPin[],
  slot: CueLayoutSlot,
  layout: { id: string; label: string }
): void {
  const idx = pins.findIndex((p) => p.slot === slot);
  const next = { slot, layoutId: layout.id, label: layout.label };
  if (idx >= 0) pins[idx] = next;
  else pins.push(next);
}

function splitClauses(note: string): string[] {
  return note
    .split(/\n+/)
    .flatMap((line) => line.split(/[。．]+/))
    .flatMap((part) => part.split(/[;、]/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function pinSectionLayouts(
  pins: CueLayoutPin[],
  note: string,
  slot: CueLayoutSlot,
  sectionSrc: string
): void {
  for (const layout of LAYOUT_HINTS) {
    const layoutSrc = layout.re.source;
    const hit =
      new RegExp(
        `(?:${sectionSrc}).{0,16}(?:は|を|で|に|へ)?.{0,8}(?:${layoutSrc})`,
        "i"
      ).test(note) ||
      new RegExp(
        `(?:${layoutSrc}).{0,16}(?:の|で|に)?.{0,8}(?:${sectionSrc})`,
        "i"
      ).test(note);
    if (hit) upsertPin(pins, slot, layout);
  }
}

/**
 * 「最初と最後はピラミッド」「サビはV字」などを CueLayoutPin に変換。
 */
export function parseCueLayoutPins(note: string): CueLayoutPin[] {
  const n = note.trim();
  if (!n) return [];
  const pins: CueLayoutPin[] = [];

  // 一文で「最初と最後はX」（intro/outro 英単語は誤爆しやすいので使わない）
  for (const layout of LAYOUT_HINTS) {
    const layoutSrc = layout.re.source;
    const both =
      new RegExp(
        `(?:最初|はじめ|先頭).{0,10}(?:と|・|/|,|、).{0,10}(?:最後|ラスト|終わり|終盤).{0,24}(?:${layoutSrc})`,
        "i"
      ).test(n) ||
      new RegExp(
        `(?:最後|ラスト|終わり|終盤).{0,10}(?:と|・|/|,|、).{0,10}(?:最初|はじめ|先頭).{0,24}(?:${layoutSrc})`,
        "i"
      ).test(n) ||
      new RegExp(
        `(?:${layoutSrc}).{0,16}(?:最初|はじめ|先頭).{0,10}(?:と|・|/|,|、).{0,10}(?:最後|ラスト|終わり|終盤)`,
        "i"
      ).test(n) ||
      new RegExp(
        `(?:最初と最後|はじめとおわり|先頭と末尾).{0,12}(?:${layoutSrc})`,
        "i"
      ).test(n);
    if (both) {
      upsertPin(pins, "first", layout);
      upsertPin(pins, "last", layout);
    }
  }

  pinSectionLayouts(pins, n, "chorus", CHORUS_RE.source);
  pinSectionLayouts(pins, n, "verse", VERSE_RE.source);
  pinSectionLayouts(pins, n, "pre_chorus", PRE_CHORUS_RE.source);

  // 「最初はX」「最後をY」「サビはZ」などスロット単独
  for (const clause of splitClauses(n)) {
    // 「グリッドはやめて」はピンではなく避け（inferKnowledgeFromNote 側で処理）
    if (/やめて|しない|禁止|避け|ダメ|駄目|不要|なし|無し/.test(clause)) {
      continue;
    }
    const layouts = findLayoutsInText(clause);
    if (layouts.length === 0) continue;
    const layout = layouts[0]!;
    const hasFirst = FIRST_RE.test(clause);
    const hasLast = LAST_RE.test(clause);
    const hasChorus = CHORUS_RE.test(clause);
    const hasVerse = VERSE_RE.test(clause);
    const hasPre = PRE_CHORUS_RE.test(clause);

    if (hasFirst && hasLast) {
      upsertPin(pins, "first", layout);
      upsertPin(pins, "last", layout);
    } else if (hasFirst) {
      upsertPin(pins, /イントロ|intro/i.test(clause) ? "intro" : "first", layout);
    } else if (hasLast) {
      upsertPin(
        pins,
        /アウトロ|outro|フィナーレ/i.test(clause) ? "outro" : "last",
        layout
      );
    } else if (hasChorus) {
      upsertPin(pins, "chorus", layout);
    } else if (hasPre) {
      upsertPin(pins, "pre_chorus", layout);
    } else if (hasVerse) {
      upsertPin(pins, "verse", layout);
    }
  }

  return pins;
}

function isChorusContext(input: {
  reasons: string[];
  label: string;
  lightingSection?: string | null;
}): boolean {
  const { reasons, label, lightingSection } = input;
  if (label === "CHORUS" || label === "FINAL_CHORUS") return true;
  if (lightingSection === "chorus") return true;
  return reasons.some(
    (r) =>
      r === "CHORUS" ||
      r === "CHORUS_START" ||
      r === "DROP" ||
      r === "FINAL_CHORUS" ||
      r.includes("CHORUS") ||
      r === "DROP"
  );
}

function isVerseContext(input: {
  reasons: string[];
  label: string;
  lightingSection?: string | null;
}): boolean {
  const { reasons, label, lightingSection } = input;
  if (label === "A_MELO" || label === "VERSE") return true;
  if (lightingSection === "verse" && label !== "B_MELO") {
    // lighting の verse は PRE_CHORUS も含むことがあるのでラベル優先
    if (label === "B_MELO" || label === "PRE_CHORUS") return false;
  }
  if (lightingSection === "verse" && !label) return true;
  return reasons.some(
    (r) =>
      r === "VERSE" ||
      r === "A_MELO" ||
      r === "SECTION_VERSE" ||
      (r.includes("VERSE") && !r.includes("PRE"))
  );
}

function isPreChorusContext(input: {
  reasons: string[];
  label: string;
  lightingSection?: string | null;
}): boolean {
  const { reasons, label } = input;
  if (label === "B_MELO" || label === "PRE_CHORUS") return true;
  return reasons.some(
    (r) =>
      r === "PRE_CHORUS" ||
      r === "B_MELO" ||
      r === "SECTION_PRE_CHORUS" ||
      r.includes("PRE_CHORUS")
  );
}

/**
 * キュー位置に対応する強制雛形を返す。
 * 端点指定（最初／最後）をセクション指定より優先する。
 */
export function resolvePinnedLayoutForCue(input: {
  pins: CueLayoutPin[];
  cueIndex: number;
  cueCount: number;
  reasonCodes?: string[];
  sectionLabel?: string;
  lightingSection?: string | null;
}): string | null {
  const {
    pins,
    cueIndex,
    cueCount,
    reasonCodes = [],
    sectionLabel,
    lightingSection,
  } = input;
  if (!pins.length || cueCount <= 0) return null;
  const reasons = reasonCodes.map((r) => r.toUpperCase());
  const label = (sectionLabel ?? "").toUpperCase();
  const ctx = { reasons, label, lightingSection };

  for (const pin of pins) {
    if (pin.slot === "first" && cueIndex === 0) return pin.layoutId;
    if (pin.slot === "last" && cueIndex === cueCount - 1) return pin.layoutId;
    if (
      pin.slot === "intro" &&
      (cueIndex === 0 || reasons.includes("INTRO") || label === "INTRO")
    ) {
      return pin.layoutId;
    }
    if (
      pin.slot === "outro" &&
      (cueIndex === cueCount - 1 ||
        reasons.includes("OUTRO") ||
        label === "OUTRO")
    ) {
      return pin.layoutId;
    }
  }

  for (const pin of pins) {
    if (pin.slot === "chorus" && isChorusContext(ctx)) return pin.layoutId;
    if (pin.slot === "pre_chorus" && isPreChorusContext(ctx)) {
      return pin.layoutId;
    }
    if (pin.slot === "verse" && isVerseContext(ctx)) return pin.layoutId;
  }
  return null;
}

/** サビ指定があるとき、サビ系 Cue を優先的に残す */
export function knowledgePrefersChorusCues(pins: CueLayoutPin[]): boolean {
  return pins.some((p) => p.slot === "chorus");
}

export function formatCueLayoutPins(pins: CueLayoutPin[]): string {
  if (!pins.length) return "";
  const slotJa: Record<CueLayoutSlot, string> = {
    first: "最初",
    last: "最後",
    intro: "INTRO",
    outro: "OUTRO",
    chorus: "サビ",
    verse: "Aメロ",
    pre_chorus: "Bメロ",
  };
  return pins.map((p) => `${slotJa[p.slot]}=${p.label}`).join(" · ");
}

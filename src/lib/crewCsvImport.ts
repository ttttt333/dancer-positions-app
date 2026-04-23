/**
 * 名簿（Crew）の CSV / Google スプレッドシート取り込みヘルパー。
 * - ローカル CSV（カンマ・タブ・セミコロン区切り、UTF-8/BOM 可）
 * - Google スプレッドシートの URL（公開ビュー / 共有リンク / 公開公開リンクのいずれか）
 *
 * Google 取り込みは「リンクを知っている人は閲覧可」または「ウェブに公開」されたシートが対象。
 * ブラウザから直接 fetch するため CORS の関係で、共有設定が不足しているとネットワークエラーになる。
 */
import type { Crew, CrewMember } from "../types/choreography";
import { parseCsvToRows } from "./projectExportFormats";
import { modDancerColorIndex } from "./dancerColorPalette";

const NAME_HEADER_KEYS = [
  "name",
  "label",
  "member",
  "membername",
  "memberlabel",
  "displayname",
  "名前",
  "氏名",
  "メンバー",
  "メンバー名",
  "ニックネーム",
  "表示名",
];

/** 姓・苗字列（「名」とは別に検出） */
const LAST_NAME_HEADER_KEYS = [
  "姓",
  "苗字",
  "lastname",
  "last",
  "family",
  "familyname",
  "surname",
];

/** 名列（「名前」「氏名」は含めない — フルネーム列と誤判定しやすいため） */
const FIRST_NAME_HEADER_KEYS = [
  "名",
  "firstname",
  "given",
  "givenname",
  "mei",
  "下の名前",
];

const COLOR_HEADER_KEYS = [
  "color",
  "colorindex",
  "colour",
  "colourindex",
  "色",
  "カラー",
];

const HEIGHT_HEADER_KEYS = [
  "height",
  "heightcm",
  "身長",
  "身長cm",
  "身長㎝",
  "stature",
];

const GRADE_HEADER_KEYS = [
  "grade",
  "学年",
  "年次",
  "year",
  "学齢",
  "class",
  "クラス",
  "schoolyear",
];

const SKILL_RANK_HEADER_KEYS = [
  "skill",
  "rank",
  "スキル",
  "ランク",
  "スキルランク",
  "個人ランク",
  "ダンス",
  "ダンスランク",
  "技能",
  "レベル",
  "順位",
  "level",
  "dancerank",
];

/** 「ダンス」単独の部分一致は「ダンス部」等にかぶるため、複合語だけ列挙 */
const SKILL_RANK_HEADER_COMPOUNDS = [
  "スキルランク",
  "個人ランク",
  "ダンスランク",
  "ダンススキル",
  "マイランク",
];

/**
 * 正規化済み見出しがスキル／ランク列か。
 * 完全一致に加え、「個人ランク」「スキルランク」のようにキーワードを含む列も拾う。
 */
function headerMatchesSkillRank(h: string): boolean {
  if (SKILL_RANK_HEADER_KEYS.includes(h)) return true;
  if (SKILL_RANK_HEADER_COMPOUNDS.some((sub) => h.includes(sub))) return true;
  return SKILL_RANK_HEADER_KEYS.some((key) => {
    if (key.length < 3) return false;
    /** 「ダンス」単体の部分一致は除外（完全一致は上の includes で拾う） */
    if (key === "ダンス") return false;
    return h.includes(key);
  });
}

/** 出欠・参加フラグ列（○＝参加など） */
const ATTENDANCE_HEADER_KEYS = [
  "出欠",
  "出席欠席",
  "出席",
  "参加",
  "参加可否",
  "参加状況",
  "attendance",
  "present",
  "participation",
  "参加フラグ",
];

/** 氏名の下の読み（1 セルに「さかい たけし」形式） */
const READING_COMBINED_HEADER_KEYS = [
  "ふりがな",
  "フリガナ",
  "furigana",
  "読み",
  "読み仮名",
  "ヨミガナ",
  "kana",
  "かな",
];

/** 苗字の読み列 */
const READING_LAST_HEADER_KEYS = [
  "セイ",
  "姓カナ",
  "姓ヨミ",
  "姓よみ",
  "苗字よみ",
  "lastkana",
  "familykana",
  "familyreading",
];

/** 名の読み列 */
const READING_FIRST_HEADER_KEYS = [
  "メイ",
  "名カナ",
  "名ヨミ",
  "名よみ",
  "givenkana",
  "givenreading",
  "firstkana",
];

const MEMBER_LABEL_MAX = 8;

/** 名簿取り込み時の表示名の作り方 */
export type RosterNameImportMode = "full" | "given_only";

export type CrewImportOptions = {
  nameMode?: RosterNameImportMode;
  /**
   * 出欠列があり、不参加・空欄などでスキップした行数。
   * `hadAttendanceColumn` が false のときは名簿に出欠列がなかった（全行対象）ことを示す。
   */
  onAttendanceFiltered?: (info: {
    excludedRows: number;
    hadAttendanceColumn: boolean;
  }) => void;
};

/**
 * 出欠セルが「参加」とみなせるか。
 * 丸記号・参加系の文言・1 / O（英大文字）などを参加とする。
 */
export function isParticipatingAttendanceCell(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (/^(参加|出席|ok|yes|true)$/i.test(lower)) return true;
  if (/^[1１]$/.test(t)) return true;
  if (/^[○〇⭕●◯]$/.test(t)) return true;
  if (/[○〇⭕●◯]/.test(t) && !/[×✕✖]/.test(t)) return true;
  return false;
}

/** 欠席・不参加とみなせるセル（出欠列の推定や隣接列の判定用） */
export function isExplicitAbsentAttendanceCell(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (/^(×|✕|✖|x|no|false|0|欠|欠席|不参加|absent|-|ー|−)$/i.test(lower))
    return true;
  if (/^[×✕✖]$/u.test(t)) return true;
  if (/[×✕✖]/.test(t) && !/[○〇⭕●◯]/.test(t)) return true;
  return false;
}

/** カタカナ（ァ〜ヶ）をひらがなに寄せる（表示の揃え用） */
function kanaToHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const cp = t.codePointAt(0);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}

/**
 * 単一セルから「名」寄りの短い表示を推定（スペース区切りは末尾を名とみなす）。
 * 漢字のみなどのときは先頭の漢字ブロック（最大 4 文字）を苗字寄りとして除く。
 */
function guessGivenFromFullCell(full: string): string {
  const t = full.trim();
  if (!t) return "";
  if (/\s/u.test(t)) {
    const parts = t.split(/\s+/u).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1] ?? t;
    return parts[0] ?? t;
  }
  const stripped = t.replace(
    /^[\u3005\u3007\u303b\u3400-\u4dbf\u4e00-\u9fff々〆]{1,4}/u,
    ""
  );
  return stripped.trim() || t;
}

function sliceLabel(s: string): string {
  return s.trim().slice(0, MEMBER_LABEL_MAX);
}

type ParsedNameRow = {
  fullRaw: string;
  givenRaw: string;
  familyRaw: string;
  /** 苗字の読み（ひらがな寄せ）。重複時の先頭 1 文字に使用 */
  familyReading: string;
  /** 名の読み（ひらがな寄せ）。あればこれを表示名のベースにする */
  givenReading: string;
  colorIndex: number;
  heightCm?: number;
  gradeLabel?: string;
  skillRankLabel?: string;
};

/** 身長セル（162 / 162.5 / 162cm 等）を cm に正規化 */
export function parseHeightCmCell(raw: string): number | undefined {
  const t = raw
    .replace(/,/g, ".")
    .replace(/cm|㎝|ｃｍ|ＣＭ/gi, "")
    .trim();
  if (!t) return undefined;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0 || n >= 300) return undefined;
  return Math.round(n * 10) / 10;
}

function parseHeaderRowIndices(headerNorm: string[]): {
  lastIdx: number;
  firstIdx: number;
  nameIdx: number;
  colorIdx: number;
  attendanceIdx: number;
  readingCombinedIdx: number;
  readingLastIdx: number;
  readingFirstIdx: number;
  heightIdx: number;
  gradeIdx: number;
  skillRankIdx: number;
  looksLikeHeader: boolean;
} {
  const looksLikeHeader = headerNorm.some(
    (h) =>
      NAME_HEADER_KEYS.includes(h) ||
      COLOR_HEADER_KEYS.includes(h) ||
      LAST_NAME_HEADER_KEYS.includes(h) ||
      FIRST_NAME_HEADER_KEYS.includes(h) ||
      ATTENDANCE_HEADER_KEYS.includes(h) ||
      READING_COMBINED_HEADER_KEYS.includes(h) ||
      READING_LAST_HEADER_KEYS.includes(h) ||
      READING_FIRST_HEADER_KEYS.includes(h) ||
      HEIGHT_HEADER_KEYS.includes(h) ||
      GRADE_HEADER_KEYS.includes(h) ||
      headerMatchesSkillRank(h)
  );
  let lastIdx = -1;
  let firstIdx = -1;
  let nameIdx = -1;
  let colorIdx = -1;
  let attendanceIdx = -1;
  let readingCombinedIdx = -1;
  let readingLastIdx = -1;
  let readingFirstIdx = -1;
  let heightIdx = -1;
  let gradeIdx = -1;
  let skillRankIdx = -1;
  if (looksLikeHeader) {
    lastIdx = headerNorm.findIndex((h) => LAST_NAME_HEADER_KEYS.includes(h));
    firstIdx = headerNorm.findIndex((h) => FIRST_NAME_HEADER_KEYS.includes(h));
    nameIdx = headerNorm.findIndex((h) => NAME_HEADER_KEYS.includes(h));
    colorIdx = headerNorm.findIndex((h) => COLOR_HEADER_KEYS.includes(h));
    attendanceIdx = headerNorm.findIndex((h) =>
      ATTENDANCE_HEADER_KEYS.includes(h)
    );
    readingCombinedIdx = headerNorm.findIndex((h) =>
      READING_COMBINED_HEADER_KEYS.includes(h)
    );
    readingLastIdx = headerNorm.findIndex((h) =>
      READING_LAST_HEADER_KEYS.includes(h)
    );
    readingFirstIdx = headerNorm.findIndex((h) =>
      READING_FIRST_HEADER_KEYS.includes(h)
    );
    heightIdx = headerNorm.findIndex((h) => HEIGHT_HEADER_KEYS.includes(h));
    gradeIdx = headerNorm.findIndex((h) => GRADE_HEADER_KEYS.includes(h));
    skillRankIdx = headerNorm.findIndex((h) => headerMatchesSkillRank(h));
  }
  return {
    lastIdx,
    firstIdx,
    nameIdx,
    colorIdx,
    attendanceIdx,
    readingCombinedIdx,
    readingLastIdx,
    readingFirstIdx,
    heightIdx,
    gradeIdx,
    skillRankIdx,
    looksLikeHeader,
  };
}

/** 「さかい たけし」「サカイ　タケシ」→ 苗字読み + 名読み */
function splitReadingFamilyGiven(combined: string): {
  familyReading: string;
  givenReading: string;
} {
  const t = combined.trim();
  if (!t) return { familyReading: "", givenReading: "" };
  const parts = t.split(/[\s\u3000]+/u).filter(Boolean);
  if (parts.length >= 2) {
    return {
      familyReading: parts[0]!,
      givenReading: parts.slice(1).join(""),
    };
  }
  return { familyReading: "", givenReading: t };
}

function rowReadingParts(
  row: string[],
  readingCombinedIdx: number,
  readingLastIdx: number,
  readingFirstIdx: number
): { familyReading: string; givenReading: string } {
  if (
    readingLastIdx >= 0 &&
    readingFirstIdx >= 0 &&
    readingLastIdx !== readingFirstIdx
  ) {
    const fam = kanaToHiragana((row[readingLastIdx] ?? "").trim());
    const giv = kanaToHiragana((row[readingFirstIdx] ?? "").trim());
    return { familyReading: fam, givenReading: giv };
  }
  if (readingCombinedIdx >= 0) {
    const raw = kanaToHiragana((row[readingCombinedIdx] ?? "").trim());
    return splitReadingFamilyGiven(raw);
  }
  return { familyReading: "", givenReading: "" };
}

/** 見出しの出欠列が無いとき、氏名列の左右隣が参加記号だらけなら出欠列とみなす */
function guessAttendanceColumnAdjacentToName(
  rows: string[][],
  dataStart: number,
  nameIdx: number,
  lastIdx: number,
  firstIdx: number,
  fallbackNameCol: number,
  skipCols: Set<number>
): number {
  if (nameIdx < 0 || rows.length <= dataStart) return -1;
  const maxCol = Math.max(0, ...rows.map((r) => r.length));
  const candidates = [nameIdx + 1, nameIdx - 1].filter(
    (c) => c >= 0 && c < maxCol && !skipCols.has(c)
  );
  let bestCol = -1;
  let bestYes = -1;
  for (const c of candidates) {
    let named = 0;
    let yes = 0;
    let decisive = 0;
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i];
      const nameCell = rowPrimaryNameRaw(
        row,
        lastIdx,
        firstIdx,
        nameIdx,
        fallbackNameCol
      );
      if (!nameCell) continue;
      named++;
      const cell = (row[c] ?? "").trim();
      if (!cell) continue;
      if (isParticipatingAttendanceCell(cell)) {
        yes++;
        decisive++;
      } else if (isExplicitAbsentAttendanceCell(cell)) {
        decisive++;
      }
    }
    if (named < 2) continue;
    const ratio = decisive / named;
    if (ratio >= 0.35 && yes >= 1 && yes > bestYes) {
      bestYes = yes;
      bestCol = c;
    }
  }
  return bestCol;
}

/** 氏名列から取れる表示名の素（空なら名簿行として無効） */
function rowPrimaryNameRaw(
  row: string[],
  lastIdx: number,
  firstIdx: number,
  nameIdx: number,
  fallbackNameCol: number
): string {
  if (lastIdx >= 0 && firstIdx >= 0 && lastIdx !== firstIdx) {
    return `${(row[lastIdx] ?? "").trim()}${(row[firstIdx] ?? "").trim()}`.trim();
  }
  if (nameIdx >= 0) return (row[nameIdx] ?? "").trim();
  return (row[fallbackNameCol] ?? "").trim();
}

function rowToParsedName(
  row: string[],
  lastIdx: number,
  firstIdx: number,
  nameIdx: number,
  colorIdx: number,
  fallbackNameCol: number
): ParsedNameRow | null {
  let fullRaw = "";
  let givenRaw = "";
  let familyRaw = "";
  if (lastIdx >= 0 && firstIdx >= 0 && lastIdx !== firstIdx) {
    familyRaw = (row[lastIdx] ?? "").trim();
    givenRaw = (row[firstIdx] ?? "").trim();
    fullRaw = `${familyRaw}${givenRaw}`.trim();
  } else if (nameIdx >= 0) {
    fullRaw = (row[nameIdx] ?? "").trim();
    givenRaw = fullRaw;
    familyRaw = "";
  } else {
    fullRaw = (row[fallbackNameCol] ?? "").trim();
    givenRaw = fullRaw;
    familyRaw = "";
  }
  if (!fullRaw) return null;

  let colorIndex = 0;
  if (colorIdx >= 0) {
    const n = parseInt((row[colorIdx] ?? "").trim(), 10);
    if (Number.isFinite(n)) colorIndex = modDancerColorIndex(n);
  }
  return {
    fullRaw,
    givenRaw,
    familyRaw,
    familyReading: "",
    givenReading: "",
    colorIndex,
  };
}

function buildLabelsWithDuplicateHandling(
  parsed: ParsedNameRow[],
  nameMode: RosterNameImportMode
): { label: string; colorIndex: number }[] {
  type Item = {
    base: string;
    prefix: string;
    colorIndex: number;
    order: number;
  };
  const items: Item[] = parsed.map((p, order) => {
    if (p.familyReading.trim() && p.givenReading.trim()) {
      const full = `${firstGrapheme(p.familyReading)}${p.givenReading.trim()}`;
      return {
        base: sliceLabel(full),
        prefix: "",
        colorIndex: p.colorIndex,
        order,
      };
    }

    let baseRaw: string;
    if (p.givenReading.trim()) {
      baseRaw = p.givenReading.trim();
    } else {
      const givenDisplay =
        p.familyRaw && p.givenRaw
          ? p.givenRaw
          : nameMode === "given_only"
            ? guessGivenFromFullCell(p.fullRaw)
            : p.fullRaw;
      baseRaw =
        nameMode === "full"
          ? p.fullRaw
          : givenDisplay.trim() || p.fullRaw.trim();
    }
    const base = sliceLabel(baseRaw);
    const prefixSource = p.familyReading.trim()
      ? p.familyReading
      : p.familyRaw.trim()
        ? p.familyRaw
        : p.fullRaw;
    const prefix = firstGrapheme(prefixSource) || "";
    return { base, prefix, colorIndex: p.colorIndex, order };
  });

  const key = (s: string) => s.toLowerCase();
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const k = key(it.base);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }

  const usedGlobal = new Set<string>();
  const out: { label: string; colorIndex: number }[] = new Array(parsed.length);

  for (const [, group] of groups) {
    group.sort((a, b) => a.order - b.order);
    const usedLocal = new Set<string>();
    /** 同一 base が 2 人以上いるときは、全員に苗字（読み）先頭 1 文字を付けて区別する（1 人目だけ素の名、はやめる） */
    const duplicateBase = group.length > 1;

    for (const it of group) {
      let pfx = it.prefix;
      let candidate: string;
      if (duplicateBase && pfx) {
        candidate = sliceLabel(`${pfx}${it.base}`);
      } else {
        candidate = it.base;
      }

      let extra = 0;
      while (usedLocal.has(candidate) || usedGlobal.has(candidate)) {
        extra += 1;
        const famR = parsed[it.order]?.familyReading.trim() ?? "";
        const fam = parsed[it.order]?.familyRaw.trim() ?? "";
        if (famR.length > extra) {
          pfx = famR.slice(0, extra + 1);
        } else if (fam.length > extra) {
          pfx = fam.slice(0, extra + 1);
        } else {
          pfx = `${it.prefix}${extra}`;
        }
        candidate = sliceLabel(`${pfx}${it.base}`);
        if (extra > 12) {
          candidate = sliceLabel(`${it.base}${it.order}`);
          break;
        }
      }

      const label = candidate;
      usedLocal.add(label);
      usedGlobal.add(label);
      out[it.order] = { label, colorIndex: it.colorIndex };
    }
  }
  return out;
}

function normalizeHeader(s: string): string {
  return s
    .replace(/\uFEFF/g, "")
    .replace(/[\s_\-/.()（）\[\]【】]/g, "")
    .toLowerCase();
}

function smartSplitFallback(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  return lines.map((l) => {
    if (l.includes("\t")) return l.split("\t").map((c) => c.trim());
    if (l.includes(";")) return l.split(";").map((c) => c.trim());
    if (l.includes(",")) return l.split(",").map((c) => c.trim());
    return [l.trim()];
  });
}

/**
 * 行データから名簿メンバーを生成する。
 * - `full`: 姓＋名または氏名列のフル表記をそのまま短縮表示
 * - `given_only`: 「名」列があればそれのみ。単一列のときは先頭漢字を除く簡易推定やスペース区切りの末尾を使用
 * - 同一表示名が複数あるときは、該当する全員に苗字の先頭 1 文字を前置（読み苗字があればその先頭、なければ漢字姓）
 * - フリガナ列があるときは名の読みを表示のベースにする（例: たけし が重複 → さたけし / なたけし）
 * - 出欠は見出し列に加え、氏名列の左右隣が ○・参加 等の列なら自動で参加行のみ抽出
 */
export function rowsToCrewMembers(
  rows: string[][],
  opts?: CrewImportOptions
): CrewMember[] {
  if (rows.length === 0) return [];

  const headerNorm = rows[0].map(normalizeHeader);
  const {
    lastIdx,
    firstIdx,
    nameIdx,
    colorIdx,
    attendanceIdx,
    readingCombinedIdx,
    readingLastIdx,
    readingFirstIdx,
    heightIdx,
    gradeIdx,
    skillRankIdx,
    looksLikeHeader,
  } = parseHeaderRowIndices(headerNorm);

  let dataStart = 0;
  let fallbackNameCol = 0;
  if (looksLikeHeader) {
    dataStart = 1;
    if (lastIdx >= 0 && firstIdx >= 0) {
      fallbackNameCol = Math.min(lastIdx, firstIdx);
    } else if (nameIdx >= 0) {
      fallbackNameCol = nameIdx;
    }
  }

  const skipForAdjacent = new Set(
    [
      lastIdx,
      firstIdx,
      nameIdx,
      colorIdx,
      readingCombinedIdx,
      readingLastIdx,
      readingFirstIdx,
      heightIdx,
      gradeIdx,
      skillRankIdx,
    ].filter((i) => i >= 0)
  );
  const nameColForAdjacent = nameIdx >= 0 ? nameIdx : fallbackNameCol;
  let effectiveAttendanceIdx = attendanceIdx;
  if (effectiveAttendanceIdx < 0 && nameColForAdjacent >= 0) {
    const guessed = guessAttendanceColumnAdjacentToName(
      rows,
      dataStart,
      nameColForAdjacent,
      lastIdx,
      firstIdx,
      fallbackNameCol,
      skipForAdjacent
    );
    if (guessed >= 0) {
      effectiveAttendanceIdx = guessed;
    }
  }

  const nameMode = opts?.nameMode ?? "full";
  const parsed: ParsedNameRow[] = [];
  let memberCounter = 0;
  let excludedByAttendance = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (effectiveAttendanceIdx >= 0) {
      const mark = (row[effectiveAttendanceIdx] ?? "").trim();
      if (!isParticipatingAttendanceCell(mark)) {
        excludedByAttendance += 1;
        continue;
      }
    }
    const pr = rowToParsedName(
      row,
      lastIdx,
      firstIdx,
      nameIdx,
      colorIdx,
      fallbackNameCol
    );
    if (!pr) continue;
    const rp = rowReadingParts(
      row,
      readingCombinedIdx,
      readingLastIdx,
      readingFirstIdx
    );
    pr.familyReading = rp.familyReading;
    pr.givenReading = rp.givenReading;
    if (colorIdx < 0) {
      pr.colorIndex = modDancerColorIndex(memberCounter);
    }
    if (heightIdx >= 0) {
      const h = parseHeightCmCell(row[heightIdx] ?? "");
      if (h !== undefined) pr.heightCm = h;
    }
    if (gradeIdx >= 0) {
      const g = (row[gradeIdx] ?? "").trim().slice(0, 32);
      if (g) pr.gradeLabel = g;
    }
    if (skillRankIdx >= 0) {
      const s = (row[skillRankIdx] ?? "").trim().slice(0, 24);
      if (s) pr.skillRankLabel = s;
    }
    memberCounter++;
    parsed.push(pr);
  }

  const hadAttendance = effectiveAttendanceIdx >= 0;

  if (parsed.length === 0) {
    opts?.onAttendanceFiltered?.({
      excludedRows: excludedByAttendance,
      hadAttendanceColumn: hadAttendance,
    });
    return [];
  }

  const labeled = buildLabelsWithDuplicateHandling(parsed, nameMode);
  const members = labeled.map((L, idx) => {
    const pr = parsed[idx]!;
    const m: CrewMember = {
      id: crypto.randomUUID(),
      label: L.label,
      colorIndex: L.colorIndex,
    };
    if (typeof pr.heightCm === "number") m.heightCm = pr.heightCm;
    if (pr.gradeLabel) m.gradeLabel = pr.gradeLabel;
    if (pr.skillRankLabel) m.skillRankLabel = pr.skillRankLabel;
    return m;
  });
  opts?.onAttendanceFiltered?.({
    excludedRows: excludedByAttendance,
    hadAttendanceColumn: hadAttendance,
  });
  return members;
}

/** 後方互換: フルネーム既定（旧 `dedupeRowsToMembers` と同じ） */
export function dedupeRowsToMembers(rows: string[][]): CrewMember[] {
  return rowsToCrewMembers(rows, { nameMode: "full" });
}

/** CSV / TSV テキストから名簿メンバー配列を作る（ヘッダ自動検出） */
export function parseCrewMembersFromCsv(
  text: string,
  opts?: CrewImportOptions
): CrewMember[] {
  let rows = parseCsvToRows(text);
  if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) {
    rows = smartSplitFallback(text);
  }
  return rowsToCrewMembers(rows, opts);
}

/** 入力された名前と CSV テキストから新しい Crew を作る（id は生成、最大 80 人で打ち切り） */
export function buildCrewFromCsv(
  name: string,
  csvText: string,
  opts?: CrewImportOptions
): Crew {
  const members = parseCrewMembersFromCsv(csvText, opts).slice(0, 80);
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || "新しい名簿",
    members,
  };
}

/** すでに行配列にパースされたデータ（XLSX / HTML / PDF など）から Crew を作る */
export function buildCrewFromRows(
  name: string,
  rows: string[][],
  opts?: CrewImportOptions
): Crew {
  const members = rowsToCrewMembers(rows, opts).slice(0, 80);
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || "新しい名簿",
    members,
  };
}

/**
 * Google スプレッドシートの URL を CSV エクスポート URL に変換する。
 * - 編集 URL: /spreadsheets/d/<id>/edit#gid=<gid> → /export?format=csv&gid=<gid>
 * - 共有 URL: /spreadsheets/d/<id>/...?gid=<gid>  → /export?format=csv&gid=<gid>
 * - 公開 URL: /spreadsheets/d/e/<pubid>/pubhtml?gid=<gid> → /pub?gid=<gid>&single=true&output=csv
 * - 既に export?format=csv のものはそのまま
 * - すでに /pub?...&output=csv のものはそのまま
 */
export function googleSheetsUrlToCsvUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!/(^|\.)google\.com$/.test(u.hostname)) return raw;
  if (!u.pathname.includes("/spreadsheets/")) return raw;

  const params = u.searchParams;
  const gidFromHash = (() => {
    const h = u.hash || "";
    const m = h.match(/gid=([0-9]+)/);
    return m?.[1] ?? null;
  })();
  const gid = params.get("gid") ?? gidFromHash ?? "0";

  const pubMatch = u.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)\//);
  if (pubMatch) {
    if (
      params.get("output") === "csv" &&
      (u.pathname.endsWith("/pub") || u.pathname.includes("/pub"))
    ) {
      return u.toString();
    }
    const pub = new URL(`https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub`);
    pub.searchParams.set("gid", gid);
    pub.searchParams.set("single", "true");
    pub.searchParams.set("output", "csv");
    return pub.toString();
  }

  const editMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (editMatch) {
    if (u.pathname.endsWith("/export") && params.get("format") === "csv") {
      return u.toString();
    }
    const exp = new URL(
      `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export`
    );
    exp.searchParams.set("format", "csv");
    exp.searchParams.set("gid", gid);
    return exp.toString();
  }
  return raw;
}

/**
 * Google スプレッドシートの URL から CSV テキストを取得する。
 * 共有設定が「リンクを知っている人は閲覧可」または「ウェブに公開」になっている必要がある。
 */
export async function fetchCsvFromGoogleSheetsUrl(
  rawUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const url = googleSheetsUrlToCsvUrl(rawUrl);
  if (!url) throw new Error("URL が空です");
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal,
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error(
      `スプレッドシートを取得できませんでした（HTTP ${res.status}）。` +
        `共有設定で「リンクを知っている人は閲覧可」または「ウェブに公開」になっているかご確認ください。`
    );
  }
  const text = await res.text();
  if (text.trim().toLowerCase().startsWith("<!doctype html") ||
      text.trim().toLowerCase().startsWith("<html")) {
    throw new Error(
      "CSV ではなくログイン画面が返ってきました。スプレッドシートの共有設定をご確認ください。"
    );
  }
  return text;
}

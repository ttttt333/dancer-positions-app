import type { LightingTextMark } from "../types/choreography";

export type { LightingTextMark };

export const LIGHTING_TEXT_SIZES = [12, 16, 20, 28, 40, 56, 72] as const;

export const LIGHTING_TEXT_COLORS = [
  { id: "black", label: "黒", value: "#111111" },
  { id: "red", label: "赤", value: "#dc2626" },
  { id: "blue", label: "青", value: "#1d4ed8" },
  { id: "yellow", label: "黄", value: "#a16207" },
  { id: "green", label: "緑", value: "#15803d" },
  { id: "orange", label: "橙", value: "#c2410c" },
  { id: "purple", label: "紫", value: "#7e22ce" },
] as const;

const SIZE_SET = new Set<number>(LIGHTING_TEXT_SIZES);
const COLOR_SET = new Set<string>(LIGHTING_TEXT_COLORS.map((item) => item.value));
const TEXT_MAX = 2000;
const MARK_MAX = 80;

type Style = { bold: boolean; size?: number; color?: string };

export type LightingTextRun = {
  text: string;
  bold: boolean;
  size: number;
  color: string;
};

function sameStyle(a: Style, b: Style): boolean {
  return a.bold === b.bold && a.size === b.size && a.color === b.color;
}

function stylesFromMarks(length: number, marks: readonly LightingTextMark[]): Style[] {
  const styles: Style[] = Array.from({ length }, () => ({ bold: false }));
  for (const mark of marks) {
    const start = Math.max(0, mark.start);
    const end = Math.min(length, mark.end);
    for (let i = start; i < end; i++) {
      const style = styles[i];
      if (!style) continue;
      if (mark.bold) style.bold = true;
      if (mark.size) style.size = mark.size;
      if (mark.color) style.color = mark.color;
    }
  }
  return styles;
}

function marksFromStyles(styles: readonly Style[]): LightingTextMark[] {
  const out: LightingTextMark[] = [];
  let i = 0;
  while (i < styles.length) {
    const style = styles[i];
    if (!style || (!style.bold && style.size == null && style.color == null)) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < styles.length && styles[j] && sameStyle(styles[j], style)) j += 1;
    const mark: LightingTextMark = { start: i, end: j };
    if (style.bold) mark.bold = true;
    if (style.size) mark.size = style.size;
    if (style.color) mark.color = style.color;
    out.push(mark);
    i = j;
    if (out.length >= MARK_MAX) break;
  }
  return out;
}

/** 保存値から印だけを取り出す。空なら undefined */
export function normalizeLightingTextMarks(
  raw: unknown,
  textLength: number
): LightingTextMark[] | undefined {
  if (!Array.isArray(raw) || textLength <= 0) return undefined;
  const cleaned: LightingTextMark[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const start = Math.floor(Number(row.start));
    const end = Math.floor(Number(row.end));
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const clippedStart = Math.max(0, start);
    const clippedEnd = Math.min(textLength, end);
    if (clippedEnd <= clippedStart) continue;
    const mark: LightingTextMark = { start: clippedStart, end: clippedEnd };
    if (row.bold === true) mark.bold = true;
    const size = Math.round(Number(row.size));
    if (SIZE_SET.has(size)) mark.size = size;
    if (typeof row.color === "string" && COLOR_SET.has(row.color.toLowerCase())) {
      const color = row.color.toLowerCase();
      if (color !== "#111111") mark.color = color;
    }
    if (mark.bold || mark.size != null || mark.color) cleaned.push(mark);
    if (cleaned.length >= MARK_MAX) break;
  }
  const merged = marksFromStyles(stylesFromMarks(textLength, cleaned));
  return merged.length > 0 ? merged : undefined;
}

/**
 * 選択範囲に見た目を足す。範囲が無いときは文全体。
 * `null` はその属性を外す。
 */
export function applyLightingTextStyle(
  text: string,
  marks: readonly LightingTextMark[] | undefined,
  start: number,
  end: number,
  patch: { bold?: boolean | null; size?: number | null; color?: string | null }
): LightingTextMark[] | undefined {
  const length = Math.min(TEXT_MAX, text.length);
  let from = Math.max(0, Math.min(start, end, length));
  let to = Math.min(length, Math.max(start, end));
  if (from === to) {
    from = 0;
    to = length;
  }
  if (from === to) return undefined;
  const styles = stylesFromMarks(length, marks ?? []);
  for (let i = from; i < to; i++) {
    const style = styles[i];
    if (!style) continue;
    if (patch.bold === true) style.bold = true;
    else if (patch.bold === false || patch.bold === null) style.bold = false;
    if (patch.size === null) delete style.size;
    else if (typeof patch.size === "number" && SIZE_SET.has(patch.size)) style.size = patch.size;
    if (patch.color === null || patch.color === "#111111") delete style.color;
    else if (typeof patch.color === "string" && COLOR_SET.has(patch.color.toLowerCase())) {
      style.color = patch.color.toLowerCase();
    }
  }
  return normalizeLightingTextMarks(marksFromStyles(styles), length);
}

/** 範囲がすべて太字か。範囲が無ければ文全体 */
export function lightingSelectionIsBold(
  text: string,
  marks: readonly LightingTextMark[] | undefined,
  start: number,
  end: number
): boolean {
  const length = text.length;
  let from = Math.max(0, Math.min(start, end, length));
  let to = Math.min(length, Math.max(start, end));
  if (from === to) {
    from = 0;
    to = length;
  }
  if (from >= to) return false;
  const styles = stylesFromMarks(length, marks ?? []);
  for (let i = from; i < to; i++) {
    if (!styles[i]?.bold) return false;
  }
  return true;
}

/** 先頭末尾の空白を除いた本文と、それに合わせた印 */
export function presentLightingRequest(
  raw: string | undefined,
  marksRaw: unknown
): { text: string; marks?: LightingTextMark[] } {
  const value = raw ?? "";
  const lead = value.length - value.trimStart().length;
  const text = value.trim().slice(0, TEXT_MAX);
  if (!text) return { text: "" };
  const shifted = Array.isArray(marksRaw)
    ? marksRaw.map((item) => {
        if (!item || typeof item !== "object") return item;
        const row = item as Record<string, unknown>;
        return {
          ...row,
          start: Number(row.start) - lead,
          end: Number(row.end) - lead,
        };
      })
    : marksRaw;
  const marks = normalizeLightingTextMarks(shifted, text.length);
  return marks ? { text, marks } : { text };
}

export function lightingTextRuns(
  text: string,
  marks: readonly LightingTextMark[] | undefined,
  defaults: { size: number; color: string }
): LightingTextRun[] {
  const body = text.slice(0, TEXT_MAX);
  const styles = stylesFromMarks(body.length, marks ?? []);
  const runs: LightingTextRun[] = [];
  let i = 0;
  while (i < body.length) {
    const style = styles[i] ?? { bold: false };
    let j = i + 1;
    while (j < body.length && styles[j] && sameStyle(styles[j], style)) j += 1;
    runs.push({
      text: body.slice(i, j),
      bold: style.bold,
      size: style.size ?? defaults.size,
      color: style.color ?? defaults.color,
    });
    i = j;
  }
  return runs;
}

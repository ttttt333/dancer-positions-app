import { parseClockToSec } from "./buildRangeExcerptProject";

export type CueExportImageMeta = {
  /** ファイル名先頭の 01, 02…。無いときは null */
  index: number | null;
  /** ファイル名から取った短いタイトル */
  title: string;
  fileName: string;
};

export type CueExportTimeRange = {
  startSec: number;
  endSec: number;
};

/** `01-キュー_1.png` / `03-Opening.png` など書き出しファイル名を読む */
export function parseCueExportImageFileName(fileName: string): CueExportImageMeta {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const noExt = base.replace(/\.(png|jpe?g|webp|gif|heic|heif)$/i, "");
  const m = /^(\d{1,3})[-_\s]+(.+)$/.exec(noExt.trim());
  if (!m) {
    return { index: null, title: noExt.trim() || base, fileName: base };
  }
  const index = Number(m[1]);
  const title = (m[2] || "").replace(/_/g, " ").trim() || `キュー ${index}`;
  return {
    index: Number.isFinite(index) ? index : null,
    title,
    fileName: base,
  };
}

/**
 * `0:00〜1:45` / `0:00-1:45` / `0.00〜1.45` などを秒範囲に。
 * 読めなければ null。
 */
export function parseCueExportTimeRangeLabel(
  raw: string | null | undefined
): CueExportTimeRange | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(.+?)\s*[〜~\-–—]\s*(.+)$/.exec(s);
  if (!m) return null;
  const startSec = parseClockish(m[1]!);
  const endSec = parseClockish(m[2]!);
  if (startSec == null || endSec == null) return null;
  if (!(endSec > startSec)) return null;
  return { startSec, endSec };
}

function parseClockish(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  // `1.45` を 1分45秒と誤読しないよう、コロン形式を優先
  const fromClock = parseClockToSec(t.replace(/．/g, "."));
  if (fromClock != null) return fromClock;
  // 書き出し PDF 旧形式 `00.00`（秒.百分秒）は使わない。分:秒のみ。
  return null;
}

/** 書き出し順（番号 → 名前）で並べる */
export function sortCueExportImageFiles<T extends { name: string }>(
  files: readonly T[]
): T[] {
  return [...files].sort((a, b) => {
    const ma = parseCueExportImageFileName(a.name);
    const mb = parseCueExportImageFileName(b.name);
    if (ma.index != null && mb.index != null && ma.index !== mb.index) {
      return ma.index - mb.index;
    }
    if (ma.index != null && mb.index == null) return -1;
    if (ma.index == null && mb.index != null) return 1;
    return a.name.localeCompare(b.name, "ja");
  });
}

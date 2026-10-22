import type { ChoreographyProjectJson } from "../types/choreography";
import {
  applyParsedPositionsAsCue,
  type ApplyParsedPositionsOptions,
} from "./applyParsedPositionsAsCue";
import type { ParsedPosition } from "./parsePositionTypes";
import type { CueExportTimeRange } from "./cueExportImageMeta";

export type RestoreCuePageInput = {
  positions: ParsedPosition[];
  /** キュー／フォーメーション名 */
  title: string;
  timeRange?: CueExportTimeRange | null;
  /** 時間がないときのフォールバック開始（直前キューの終端など） */
  fallbackStartSec?: number;
  /** フォールバック尺（秒） */
  fallbackSpanSec?: number;
};

export type RestoreCuesFromParsedPagesResult = {
  project: ChoreographyProjectJson;
  cueCount: number;
  dancerPeak: number;
  warnings: string[];
};

/**
 * 解析済みページを順にキュー化して作品へ載せる。
 * ダンサー id は名前で前キューと揃える（`applyParsedPositionsAsCue` 側）。
 */
export function restoreCuesFromParsedPages(
  project: ChoreographyProjectJson,
  pages: readonly RestoreCuePageInput[],
  opts?: {
    durationSec?: number | null;
    /** true なら既存キュー／使われないフォーメーションを捨ててから載せる */
    replaceExistingCues?: boolean;
  }
): RestoreCuesFromParsedPagesResult | null {
  if (pages.length === 0) return null;

  let next: ChoreographyProjectJson;
  if (opts?.replaceExistingCues) {
    const baseId = crypto.randomUUID();
    next = {
      ...project,
      cues: [],
      formations: [
        {
          id: baseId,
          name: "復元ベース",
          dancers: [],
          confirmedDancerCount: 0,
          setPieces: [],
        },
      ],
      activeFormationId: baseId,
    };
  } else {
    next = project;
  }

  const warnings: string[] = [];
  let cursorSec = 0;
  let cueCount = 0;
  let dancerPeak = 0;
  const fallbackSpan = opts?.durationSec
    ? Math.max(2, opts.durationSec / Math.max(1, pages.length))
    : 8;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (!page.positions.length) {
      warnings.push(`${page.title || `ページ ${i + 1}`}: 立ち位置が空のためスキップ`);
      continue;
    }

    let tStartSec: number;
    let tEndSec: number | undefined;
    if (page.timeRange) {
      tStartSec = page.timeRange.startSec;
      tEndSec = page.timeRange.endSec;
      cursorSec = page.timeRange.endSec;
    } else {
      tStartSec = page.fallbackStartSec ?? cursorSec;
      const span = page.fallbackSpanSec ?? fallbackSpan;
      tEndSec = tStartSec + span;
      cursorSec = tEndSec;
      warnings.push(
        `${page.title || `ページ ${i + 1}`}: 再生時間が読めなかったため ${formatRough(tStartSec)}〜${formatRough(tEndSec)} に仮置き`
      );
    }

    const applyOpts: ApplyParsedPositionsOptions = {
      positions: page.positions,
      tStartSec,
      tEndSec,
      formationName: page.title || `キュー ${i + 1}`,
      durationSec: opts?.durationSec,
    };

    const applied = applyParsedPositionsAsCue(next, applyOpts);
    if (!applied) {
      warnings.push(
        `${page.title || `ページ ${i + 1}`}: キュー追加に失敗（上限または人数0）`
      );
      continue;
    }
    next = applied.project;
    cueCount += 1;
    dancerPeak = Math.max(dancerPeak, page.positions.length);
  }

  if (cueCount === 0) return null;
  return { project: next, cueCount, dancerPeak, warnings };
}

function formatRough(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

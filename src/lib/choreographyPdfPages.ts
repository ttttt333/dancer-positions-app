import { sortCuesByStart } from "../core/timelineController";
import {
  DANCER_COLOR_PALETTE_HEX,
  modDancerColorIndex,
} from "./dancerColorPalette";
import type { ExportFormationFrame } from "./drawStageExportFrame";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";

export type ChoreographyPdfPage = {
  title: string;
  timeLabel: string;
  formation: ExportFormationFrame;
};

export type ChoreographyPdfLabels = {
  cueN: (n: number) => string;
  formationN: (n: number) => string;
  formationFallback: string;
};

const DEFAULT_PDF_LABELS: ChoreographyPdfLabels = {
  cueN: (n) => `キュー ${n}`,
  formationN: (n) => `フォーメーション ${n}`,
  formationFallback: "フォーメーション",
};

/** @deprecated PDF では formatPdfClock / formatPdfTimeRange を使う */
export function formatSecDot(sec: number): string {
  const v = Math.max(0, Number.isFinite(sec) ? sec : 0);
  let whole = Math.floor(v + 1e-9);
  let hundredths = Math.round((v - whole) * 100);
  if (hundredths >= 100) {
    whole += 1;
    hundredths = 0;
  }
  return `${String(whole).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

/** 秒 → `0:00` / `1:45` 形式（分:秒） */
export function formatPdfClock(sec: number): string {
  const v = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalSec = Math.round(v);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 例: `0:00〜1:45` */
export function formatPdfTimeRange(startSec: number, endSec: number): string {
  return `${formatPdfClock(startSec)}〜${formatPdfClock(endSec)}`;
}

function mapDancers(dancers: DancerSpot[]) {
  return dancers.map((d) => ({
    name: d.label || "?",
    markerBadge: d.markerBadge,
    markerBadgeSource: d.markerBadgeSource,
    centerDistanceLabelXPct: d.centerDistanceLabelXPct,
    nameBelowFontPx: d.nameBelowFontPx,
    sizePx: d.sizePx,
    color: DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(d.colorIndex ?? 0)],
    x: d.xPct / 100,
    y: d.yPct / 100,
  }));
}

/** キューがあればキュー単位、なければフォーメーション単位でページを作る */
export function buildChoreographyPdfPages(
  project: ChoreographyProjectJson,
  labels: ChoreographyPdfLabels = DEFAULT_PDF_LABELS
): ChoreographyPdfPage[] {
  const cues = sortCuesByStart(project.cues);
  if (cues.length > 0) {
    return cues.map((cue, i) => {
      const formation =
        project.formations.find((f) => f.id === cue.formationId) ??
        project.formations[0];
      return {
        title: labels.cueN(i + 1),
        timeLabel: formatPdfTimeRange(cue.tStartSec, cue.tEndSec),
        formation: {
          startSec: cue.tStartSec,
          dancers: mapDancers(formation?.dancers ?? []),
        },
      };
    });
  }

  const formations = project.formations.length > 0 ? project.formations : null;
  if (!formations) {
    return [
      {
        title: (project.pieceTitle?.trim() || labels.formationFallback).trim(),
        timeLabel: "—",
        formation: { startSec: 0, dancers: [] },
      },
    ];
  }

  return formations.map((f, i) => ({
    title: labels.formationN(i + 1),
    timeLabel: "—",
    formation: {
      startSec: i,
      dancers: mapDancers(f.dancers ?? []),
    },
  }));
}

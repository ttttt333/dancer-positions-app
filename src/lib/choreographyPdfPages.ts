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
  project: ChoreographyProjectJson
): ChoreographyPdfPage[] {
  const cues = sortCuesByStart(project.cues);
  if (cues.length > 0) {
    return cues.map((cue) => {
      const formation =
        project.formations.find((f) => f.id === cue.formationId) ??
        project.formations[0];
      const title =
        (cue.name?.trim() ||
          formation?.name?.trim() ||
          project.pieceTitle?.trim() ||
          "フォーメーション").trim() || "フォーメーション";
      return {
        title,
        timeLabel: `${formatSecDot(cue.tStartSec)}-${formatSecDot(cue.tEndSec)}`,
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
        title: (project.pieceTitle?.trim() || "フォーメーション").trim(),
        timeLabel: "—",
        formation: { startSec: 0, dancers: [] },
      },
    ];
  }

  return formations.map((f, i) => ({
    title: (f.name?.trim() || `フォーメーション ${i + 1}`).trim(),
    timeLabel: "—",
    formation: {
      startSec: i,
      dancers: mapDancers(f.dancers ?? []),
    },
  }));
}

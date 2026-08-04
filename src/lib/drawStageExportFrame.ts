import type { DancerSpot } from "../types/choreography";
import {
  dancerCircleInnerBelowLabel,
  markerCircleLabelFontPx,
} from "./stageBoardModelHelpers";
import {
  dancerNameBelowLabelOffsetPx,
  effectiveNameBelowFontPx,
} from "./stageNameBelowFontSizing";
import { computeCenterFieldGuideLineMarks } from "./stageGuideLineMarks";
import type { StageExportAppearance } from "./stageExportAppearance";

export type ExportDancerFrame = {
  name: string;
  markerBadge?: string;
  markerBadgeSource?: DancerSpot["markerBadgeSource"];
  centerDistanceLabelXPct?: number;
  nameBelowFontPx?: number;
  sizePx?: number;
  color: string;
  x: number;
  y: number;
};

export type ExportFormationFrame = {
  startSec: number;
  dancers: ExportDancerFrame[];
};

type FloorRect = { x: number; y: number; w: number; h: number };

function defaultExportMarkerPx(main: FloorRect): number {
  return Math.max(20, Math.min(36, main.w * 0.056));
}

/** 書き出し1人分の印直径（ギャップ補間の sizePx を反映） */
function exportDancerMarkerPx(main: FloorRect, dancer: ExportDancerFrame): number {
  if (typeof dancer.sizePx === "number" && Number.isFinite(dancer.sizePx)) {
    return Math.max(10, Math.min(140, Math.round(dancer.sizePx)));
  }
  return defaultExportMarkerPx(main);
}

function fitStageLayout(
  width: number,
  height: number,
  appearance: StageExportAppearance
): {
  outer: FloorRect;
  main: FloorRect;
} {
  const outerW = appearance.showShell
    ? appearance.Wmm + 2 * appearance.Smm
    : appearance.Wmm || 12;
  const outerD = appearance.showShell
    ? appearance.Dmm + appearance.Bmm
    : appearance.Dmm || 8;
  const aspect = outerW / outerD;
  const pad = 28;
  const maxW = width - pad * 2;
  const maxH = height - pad * 2 - 24;
  let ow = maxW;
  let oh = ow / aspect;
  if (oh > maxH) {
    oh = maxH;
    ow = oh * aspect;
  }
  const ox = (width - ow) / 2;
  const oy = (height - oh) / 2 - 8;

  const outer: FloorRect = { x: ox, y: oy, w: ow, h: oh };

  if (!appearance.showShell || appearance.Wmm <= 0 || appearance.Dmm <= 0) {
    return { outer, main: outer };
  }

  const sw = appearance.Smm / outerW;
  const bw = appearance.Bmm / outerD;
  const mw = appearance.Wmm / outerW;
  const mh = appearance.Dmm / outerD;

  const main: FloorRect = {
    x: ox + ow * sw,
    y: oy + oh * bw,
    w: ow * mw,
    h: oh * mh,
  };
  return { outer, main };
}

function drawShellChrome(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  appearance: StageExportAppearance,
  outer: FloorRect,
  main: FloorRect
) {
  ctx.fillStyle = "#0a0f18";
  ctx.fillRect(0, 0, width, height);

  if (appearance.showShell && appearance.Bmm > 0) {
    const bh = main.y - outer.y;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, outer.y, outer.w, bh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(outer.x + 0.5, outer.y + 0.5, outer.w - 1, bh - 1);
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("舞台裏", outer.x + outer.w / 2, outer.y + bh / 2);
  }

  if (appearance.showShell && appearance.Smm > 0) {
    const sw = main.x - outer.x;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, main.y, sw, main.h);
    ctx.fillRect(main.x + main.w, main.y, sw, main.h);
    ctx.fillStyle = "rgba(148,163,184,0.65)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.save();
    ctx.translate(outer.x + sw / 2, main.y + main.h / 2);
    ctx.fillText("サイド", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(main.x + main.w + sw / 2, main.y + main.h / 2);
    ctx.fillText("サイド", 0, 0);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(main.x, main.y, main.x, main.y + main.h);
  grad.addColorStop(0, "#0f1729");
  grad.addColorStop(0.42, "#0a0f18");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(main.x, main.y, main.w, main.h);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(main.x + 1, main.y + 1, main.w - 2, main.h - 2);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(outer.x + 1, outer.y + 1, outer.w - 2, outer.h - 2);

  const bandH = Math.min(22, main.h * 0.08);
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.fillRect(main.x, main.y + main.h - bandH, main.w, bandH);
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("客席", main.x + main.w / 2, main.y + main.h - bandH / 2);
}

function drawAudienceGuideLabels(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  appearance: StageExportAppearance
) {
  const marks = computeCenterFieldGuideLineMarks(
    appearance.Wmm,
    appearance.centerFieldGuideIntervalMm
  );
  if (marks.length === 0) return;

  const bandH = Math.min(22, main.h * 0.08);
  const labelY = main.y + main.h - bandH - 10;
  const fontPx = Math.max(10, Math.min(14, Math.round(main.w * 0.016)));
  const cx = main.x + main.w / 2;

  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(cx, main.y + main.h - bandH - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(251,191,36,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `bold ${fontPx}px system-ui,sans-serif`;
  ctx.fillStyle = "#fef3c7";
  ctx.textBaseline = "middle";

  for (const { xp, k } of marks) {
    const x = main.x + (xp / 100) * main.w;
    ctx.textAlign =
      xp <= 1 ? "left" : xp >= 99 ? "right" : "center";
    ctx.fillText(String(k), x, labelY);
  }
}

/** 設定オフ時も見えるよう 10% 間隔の基準線 */
function drawBaselineGrid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  opts?: { stronger?: boolean }
) {
  const stronger = opts?.stronger === true;
  for (let p = 10; p < 100; p += 10) {
    if (Math.abs(p - 50) < 0.5) continue;
    const major = p % 25 === 0;
    if (stronger && major) {
      ctx.strokeStyle = "rgba(203,213,225,0.72)";
      ctx.lineWidth = 1.5;
    } else if (stronger) {
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 1.25;
    } else {
      ctx.strokeStyle = "rgba(100,116,139,0.45)";
      ctx.lineWidth = 1;
    }
    const x = main.x + (p / 100) * main.w;
    const y = main.y + (p / 100) * main.h;
    ctx.beginPath();
    ctx.moveTo(x, main.y);
    ctx.lineTo(x, main.y + main.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(main.x, y);
    ctx.lineTo(main.x + main.w, y);
    ctx.stroke();
  }
}

function drawCenterLine(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect
) {
  const cx = main.x + main.w / 2;
  ctx.strokeStyle = "rgba(251,191,36,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, main.y);
  ctx.lineTo(cx, main.y + main.h);
  ctx.stroke();
}

/**
 * 細かい mm 刻みを中央から有限本だけ引くと、間隔が狭いとき中央に線が密集する。
 * 画面幅に対して最低ピクセル間隔を確保し、全域に均等に描く。
 */
function drawFineGridAxis(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  stepPct: number,
  axis: "x" | "y"
) {
  const spanPx = axis === "x" ? main.w : main.h;
  if (!(stepPct > 0) || !(spanPx > 0)) return;

  const minGapPx = 10;
  const minStepPct = (minGapPx / spanPx) * 100;
  let step = stepPct;
  if (step < minStepPct) {
    // 元の刻みの整数倍に丸めて、見た目の間隔だけ間引く
    const mult = Math.max(1, Math.ceil(minStepPct / step));
    step = step * mult;
  }
  // 片側あたりの最大本数（中央〜端）
  const maxHalf = 40;
  if (50 / step > maxHalf) {
    step = 50 / maxHalf;
  }

  ctx.strokeStyle = "rgba(148,163,184,0.45)";
  ctx.lineWidth = 1;

  for (let p = step; p < 100 - 1e-6; p += step) {
    if (Math.abs(p - 50) < step * 0.25) continue;
    if (axis === "x") {
      const x = main.x + (p / 100) * main.w;
      ctx.beginPath();
      ctx.moveTo(x, main.y);
      ctx.lineTo(x, main.y + main.h);
      ctx.stroke();
    } else {
      const y = main.y + (p / 100) * main.h;
      ctx.beginPath();
      ctx.moveTo(main.x, y);
      ctx.lineTo(main.x + main.w, y);
      ctx.stroke();
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  appearance: StageExportAppearance,
  main: FloorRect
) {
  const print = appearance.printFriendlyGrid === true;
  drawBaselineGrid(ctx, main, { stronger: print });
  drawCenterLine(ctx, main);

  if (print) return;

  if (
    appearance.stageGridLinesVertical &&
    appearance.stepXPct != null &&
    appearance.stepXPct > 0
  ) {
    drawFineGridAxis(ctx, main, appearance.stepXPct, "x");
  }
  if (
    appearance.stageGridLinesHorizontal &&
    appearance.stepYPct != null &&
    appearance.stepYPct > 0
  ) {
    drawFineGridAxis(ctx, main, appearance.stepYPct, "y");
  }
}

function resolveExportCircleLabel(
  dancer: ExportDancerFrame,
  dancerIndex: number,
  appearance: StageExportAppearance
): string {
  if (appearance.dancerLabelBelow) {
    const xPct = dancer.x * 100;
    return dancerCircleInnerBelowLabel(
      {
        id: "",
        label: dancer.name,
        markerBadge: dancer.markerBadge,
        markerBadgeSource: dancer.markerBadgeSource,
        centerDistanceLabelXPct: dancer.centerDistanceLabelXPct,
        xPct,
        yPct: dancer.y * 100,
        colorIndex: 0,
      },
      dancerIndex,
      appearance.Wmm > 0
        ? { effXPct: xPct, stageWidthMm: appearance.Wmm }
        : undefined
    );
  }
  return dancer.name.trim() || String(dancerIndex + 1);
}

function drawDancers(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  formation: ExportFormationFrame,
  main: FloorRect,
  appearance: StageExportAppearance
) {
  formation.dancers.forEach((dancer, di) => {
    const markerPx = exportDancerMarkerPx(main, dancer);
    const markerR = markerPx / 2;
    const x = main.x + dancer.x * main.w;
    const y = main.y + dancer.y * main.h;

    ctx.beginPath();
    ctx.arc(x, y, markerR, 0, Math.PI * 2);
    ctx.fillStyle = dancer.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const inner = resolveExportCircleLabel(dancer, di, appearance);
    if (inner) {
      ctx.fillStyle = "#0f172a";
      const fontPx = markerCircleLabelFontPx(markerPx, inner);
      ctx.font = `bold ${fontPx}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(inner, x, y);
    }

    if (appearance.dancerLabelBelow) {
      const belowName = dancer.name.trim();
      if (belowName) {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        const belowFontPx = effectiveNameBelowFontPx(
          { nameBelowFontPx: dancer.nameBelowFontPx },
          markerPx
        );
        ctx.font = `${belowFontPx}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const nameGapPx = Math.max(
          6,
          Math.round(
            dancerNameBelowLabelOffsetPx(markerPx, 0) - Math.round(markerPx / 2)
          )
        );
        ctx.fillText(belowName, x, y + markerR + nameGapPx);
      }
    }
  });
}

/** 舞台枠・グリッド・番号付きマーカーを canvas に描画（高速パス） */
export function drawStageExportFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  formations: ExportFormationFrame[],
  appearance: StageExportAppearance,
  /** 書き出しループが時刻順に進むときの O(1) 参照用 */
  formationIndex?: number
) {
  const formation =
    formationIndex !== undefined
      ? formations[formationIndex]
      : ([...formations].reverse().find((f) => f.startSec <= t) ??
        formations[0]);

  const { outer, main } = fitStageLayout(width, height, appearance);

  ctx.save();
  if (appearance.rotDeg !== 0) {
    const cx = outer.x + outer.w / 2;
    const cy = outer.y + outer.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((appearance.rotDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  drawShellChrome(ctx, width, height, appearance, outer, main);
  drawGrid(ctx, appearance, main);
  drawAudienceGuideLabels(ctx, main, appearance);
  if (formation) {
    drawDancers(ctx, formation, main, appearance);
  }

  ctx.restore();
}

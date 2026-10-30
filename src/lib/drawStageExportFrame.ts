import type {
  DancerSpot,
  StageCenterMark,
  StageFloorLineMarkup,
  StageFloorMarkup,
  StageFloorTextMarkup,
} from "../types/choreography";
import {
  dancerCircleInnerBelowLabel,
  floorTextColorHex,
  floorTextFontCss,
  floorTextLayer,
  floorTextMarkupScale,
  markerCircleLabelFontPx,
} from "./stageBoardModelHelpers";
import {
  dancerNameBelowLabelOffsetPx,
  effectiveNameBelowFontPx,
} from "./stageNameBelowFontSizing";
import { computeCenterFieldGuideLineMarks } from "./stageGuideLineMarks";
import type { StageExportAppearance } from "./stageExportAppearance";
import {
  dancerFaceStampMeta,
  normalizeDancerFaceStamp,
  type DancerFaceStampId,
} from "./dancerFaceStamp";
import {
  dancerMarkerShapeLabelCenterYPct,
  dancerMarkerShapeLabelScale,
  normalizeDancerMarkerShape,
  traceDancerMarkerShapePath,
  type DancerMarkerShape,
} from "./dancerMarkerShape";
import { resolveCenterMarkAxes } from "./stageCenterMarks";
import { buildSleeveCurtainMarksFromCurtains } from "./stageSleeveCurtains";

export type ExportDancerFrame = {
  name: string;
  markerBadge?: string;
  markerBadgeSource?: DancerSpot["markerBadgeSource"];
  centerDistanceLabelXPct?: number;
  nameBelowFontPx?: number;
  sizePx?: number;
  faceStamp?: DancerFaceStampId;
  markerShape?: DancerMarkerShape;
  /** 印の向き（度、時計回り）。ステージ座標系での値 */
  facingDeg?: number;
  color: string;
  x: number;
  y: number;
};

export type ExportFormationFrame = {
  startSec: number;
  dancers: ExportDancerFrame[];
  /** この時刻のフォーメーション床マーク（テキスト・線） */
  floorMarkup?: StageFloorMarkup[];
};

export type FloorRect = { x: number; y: number; w: number; h: number };

/** 編集画面の標準印。動画ではこの直径を舞台幅の基準にする */
const EDITOR_MARKER_REF_PX = 18;
/**
 * 動画の本編幅に対する標準印の割合。
 * 近い隊形でも隣と重なりすぎないよう、床のおよそ 1/28。
 */
const VIDEO_MARKER_OF_STAGE = 0.036;
/** 名下フォントの編集画面での標準（px）。個別指定はこの値との比で拡縮する */
const EDITOR_NAME_FONT_REF_PX = 17;

function defaultExportMarkerPx(main: FloorRect): number {
  return Math.max(20, Math.min(36, main.w * 0.056));
}

/** 書き出し1人分の印直径（ギャップ補間の sizePx を反映） */
export function exportDancerMarkerPx(
  main: FloorRect,
  dancer: ExportDancerFrame,
  videoFill = false
): number {
  if (!videoFill) {
    if (typeof dancer.sizePx === "number" && Number.isFinite(dancer.sizePx)) {
      return Math.max(10, Math.min(140, Math.round(dancer.sizePx)));
    }
    return defaultExportMarkerPx(main);
  }
  const editorPx =
    typeof dancer.sizePx === "number" && Number.isFinite(dancer.sizePx)
      ? Math.max(10, Math.min(140, Math.round(dancer.sizePx)))
      : EDITOR_MARKER_REF_PX;
  const rel = editorPx / EDITOR_MARKER_REF_PX;
  const raw = main.w * VIDEO_MARKER_OF_STAGE * rel;
  const minPx = main.w * 0.024;
  const maxPx = Math.min(main.w * 0.05, main.h * 0.075);
  if (!(maxPx > minPx)) return Math.max(8, Math.round(raw));
  return Math.round(Math.min(maxPx, Math.max(minPx, raw)));
}

/** 丸の下の名前。動画では編集画面の 48px 上限を使わず、印の大きさに合わせる */
export function exportNameBelowFontPx(
  markerPx: number,
  nameBelowFontPx: number | undefined,
  videoFill = false
): number {
  if (!videoFill) {
    return effectiveNameBelowFontPx({ nameBelowFontPx }, markerPx);
  }
  const editorFont =
    typeof nameBelowFontPx === "number" && Number.isFinite(nameBelowFontPx)
      ? Math.max(8, Math.min(48, Math.round(nameBelowFontPx)))
      : EDITOR_NAME_FONT_REF_PX;
  const rel = editorFont / EDITOR_NAME_FONT_REF_PX;
  const raw = markerPx * 0.36 * rel;
  const minPx = markerPx * 0.28;
  const maxPx = markerPx * 0.46;
  return Math.round(Math.min(maxPx, Math.max(minPx, raw)));
}

export type StageExportFrameLayout = {
  outer: FloorRect;
  main: FloorRect;
};

function fitStageLayout(
  width: number,
  height: number,
  appearance: StageExportAppearance
): StageExportFrameLayout {
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

/**
 * 動画用。袖・舞台裏では本編を縮めず、床の縦横比を保ったまま枠へ収める。
 * 下端だけ名前がはみ出す分を空ける。
 */
function fitVideoFillLayout(
  width: number,
  height: number,
  appearance: StageExportAppearance
): StageExportFrameLayout {
  const stageW = appearance.Wmm > 0 ? appearance.Wmm : 12;
  const stageD = appearance.Dmm > 0 ? appearance.Dmm : 8;
  const aspect = stageW / stageD;
  const shortSide = Math.min(width, height);
  const edge = Math.max(6, Math.round(shortSide * 0.012));
  const nameBleed = Math.max(edge, Math.round(shortSide * 0.055));
  const maxW = Math.max(2, width - edge * 2);
  const maxH = Math.max(2, height - edge - nameBleed);
  let mw = maxW;
  let mh = mw / aspect;
  if (mh > maxH) {
    mh = maxH;
    mw = mh * aspect;
  }
  const mx = (width - mw) / 2;
  const my = edge + (maxH - mh) / 2;

  const sideRatio =
    appearance.showShell && appearance.Smm > 0 ? appearance.Smm / stageW : 0;
  const backRatio =
    appearance.showShell && appearance.Bmm > 0 ? appearance.Bmm / stageD : 0;
  const sidePx = mw * sideRatio;
  const backPx = mh * backRatio;
  return {
    outer: {
      x: mx - sidePx,
      y: my - backPx,
      w: mw + sidePx * 2,
      h: mh + backPx,
    },
    main: { x: mx, y: my, w: mw, h: mh },
  };
}

export function layoutStageExportFrame(
  width: number,
  height: number,
  appearance: StageExportAppearance
): StageExportFrameLayout {
  if (appearance.videoFill) return fitVideoFillLayout(width, height, appearance);
  return fitStageLayout(width, height, appearance);
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

  const chromeFont = appearance.videoFill
    ? Math.max(13, Math.round(Math.min(main.w, main.h) * 0.028))
    : 11;

  if (appearance.showShell && appearance.Bmm > 0) {
    const bh = main.y - outer.y;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, outer.y, outer.w, bh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(outer.x + 0.5, outer.y + 0.5, outer.w - 1, bh - 1);
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    ctx.font = `${chromeFont}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      appearance.stageLabels?.backstage ?? "舞台裏",
      outer.x + outer.w / 2,
      outer.y + bh / 2
    );
  }

  if (appearance.showShell && appearance.Smm > 0) {
    const sw = main.x - outer.x;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, main.y, sw, main.h);
    ctx.fillRect(main.x + main.w, main.y, sw, main.h);
    ctx.fillStyle = "rgba(148,163,184,0.65)";
    ctx.font = `${Math.max(10, chromeFont - 1)}px system-ui,sans-serif`;
    ctx.save();
    ctx.translate(outer.x + sw / 2, main.y + main.h / 2);
    ctx.fillText(appearance.stageLabels?.side ?? "サイド", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(main.x + main.w + sw / 2, main.y + main.h / 2);
    ctx.fillText(appearance.stageLabels?.side ?? "サイド", 0, 0);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(main.x, main.y, main.x, main.y + main.h);
  grad.addColorStop(0, "#0f1729");
  grad.addColorStop(0.42, "#0a0f18");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(main.x, main.y, main.w, main.h);

  const frameStroke = appearance.videoFill
    ? Math.max(3, Math.round(Math.min(width, height) * 0.0045))
    : 2.5;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = frameStroke;
  ctx.strokeRect(main.x + 1, main.y + 1, main.w - 2, main.h - 2);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(2, frameStroke - 1);
  ctx.strokeRect(outer.x + 1, outer.y + 1, outer.w - 2, outer.h - 2);

  const audience = appearance.stageLabels?.audience ?? "客席";
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (appearance.videoFill) {
    const labelPx = Math.max(12, Math.round(main.w * 0.02));
    const roomBelow = height - (main.y + main.h);
    if (roomBelow > labelPx + 4) {
      ctx.font = `bold ${labelPx}px system-ui,sans-serif`;
      ctx.fillText(audience, main.x + main.w / 2, main.y + main.h + roomBelow * 0.45);
    }
    return;
  }

  const bandH = Math.min(22, main.h * 0.08);
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.fillRect(main.x, main.y + main.h - bandH, main.w, bandH);
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.fillText(
    audience,
    main.x + main.w / 2,
    main.y + main.h - bandH / 2
  );
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

  const bandH = appearance.videoFill
    ? Math.min(8, main.h * 0.015)
    : Math.min(22, main.h * 0.08);
  const labelY = main.y + main.h - bandH - (appearance.videoFill ? 16 : 10);
  const fontPx = appearance.videoFill
    ? Math.max(14, Math.min(28, Math.round(main.w * 0.022)))
    : Math.max(10, Math.min(14, Math.round(main.w * 0.016)));
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
    const markerPx = exportDancerMarkerPx(main, dancer, appearance.videoFill === true);
    const markerR = markerPx / 2;
    const x = main.x + dancer.x * main.w;
    const y = main.y + dancer.y * main.h;

    const shape = normalizeDancerMarkerShape(dancer.markerShape);
    const facingRad =
      typeof dancer.facingDeg === "number" && Number.isFinite(dancer.facingDeg)
        ? (dancer.facingDeg * Math.PI) / 180
        : 0;

    ctx.beginPath();
    if (shape) {
      traceDancerMarkerShapePath(ctx, shape, x, y, markerPx, facingRad);
    } else {
      ctx.arc(x, y, markerR, 0, Math.PI * 2);
    }
    ctx.fillStyle = dancer.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = appearance.videoFill
      ? Math.max(1.75, markerPx * 0.04)
      : 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    /** 三角・矢印は文字を太い側へ寄せる（向きに合わせて回す） */
    const labelOffset =
      ((dancerMarkerShapeLabelCenterYPct(shape) - 50) / 100) * markerPx;
    const lx = x - Math.sin(facingRad) * labelOffset;
    const ly = y + Math.cos(facingRad) * labelOffset;
    const labelScale = dancerMarkerShapeLabelScale(shape);

    const stamp = normalizeDancerFaceStamp(dancer.faceStamp);
    if (stamp) {
      const emoji = dancerFaceStampMeta(stamp).emoji;
      ctx.fillStyle = "#0f172a";
      const fontPx = Math.max(10, Math.round(markerPx * 0.55 * labelScale));
      ctx.font = `${fontPx}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, lx, ly);
    } else {
      const inner = resolveExportCircleLabel(dancer, di, appearance);
      const nameUnderMarker = dancer.name.trim();
      const nameDrawnBelow =
        appearance.videoFill === true &&
        nameUnderMarker.length > 0 &&
        inner === nameUnderMarker;
      if (inner && !nameDrawnBelow) {
        ctx.fillStyle = "#0f172a";
        const fitted = Math.round(
          markerCircleLabelFontPx(markerPx, inner) * labelScale
        );
        const readable = Math.round(markerPx * 0.32 * labelScale);
        const fontPx = appearance.videoFill
          ? inner.length <= 3
            ? Math.max(fitted, Math.min(readable, Math.round(markerPx * 0.38)))
            : Math.max(8, fitted)
          : Math.max(6, fitted);
        ctx.font = `bold ${fontPx}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(inner, lx, ly);
      }
    }

    const belowName = dancer.name.trim();
    const showNameBelow =
      Boolean(belowName) &&
      (appearance.videoFill || appearance.dancerLabelBelow || Boolean(stamp));
    if (showNameBelow && belowName) {
      ctx.save();
      ctx.fillStyle = appearance.videoFill ? "#f8fafc" : "rgba(255,255,255,0.8)";
      if (appearance.videoFill) {
        ctx.shadowColor = "rgba(0,0,0,0.92)";
        ctx.shadowBlur = Math.max(2, markerPx * 0.05);
        ctx.shadowOffsetY = 1;
      }
      const belowFontPx = exportNameBelowFontPx(
        markerPx,
        dancer.nameBelowFontPx,
        appearance.videoFill === true
      );
      ctx.font = `600 ${belowFontPx}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const nameGapPx = Math.max(
        6,
        Math.round(
          dancerNameBelowLabelOffsetPx(markerPx, 0) - Math.round(markerPx / 2)
        )
      );
      ctx.fillText(belowName, x, y + markerR + nameGapPx);
      ctx.restore();
    }
  });
}

/** エディタと同じルールで書き出し用ヘソ一覧を決める */
export function resolveExportCenterMarks(
  appearance: StageExportAppearance
): StageCenterMark[] {
  if (appearance.stageHesoVisible !== true) return [];
  if (appearance.stageCenterMarks && appearance.stageCenterMarks.length > 0) {
    return appearance.stageCenterMarks;
  }
  return [
    {
      id: "legacy-heso",
      xPct: 50,
      yPct: 50,
      shape: "circle",
      rxPct: 2.5,
    },
  ];
}

function drawCenterMarks(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  appearance: StageExportAppearance
) {
  const marks = resolveExportCenterMarks(appearance);
  if (marks.length === 0) return;
  const floorAspect = main.h > 0 ? main.w / main.h : 1;

  for (const mark of marks) {
    const { rx, ry } = resolveCenterMarkAxes(mark, floorAspect);
    const cx = main.x + (mark.xPct / 100) * main.w;
    const cy = main.y + (mark.yPct / 100) * main.h;
    const rxPx = (rx / 100) * main.w;
    const ryPx = (ry / 100) * main.h;
    const armX = Math.max(rxPx * 1.35, 4);
    const armY = Math.max(ryPx * 1.35, 4);

    ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
    ctx.lineWidth = Math.max(1.25, Math.min(2.5, main.w * 0.0035));
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxPx, ryPx, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(248, 250, 252, 0.85)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - armY);
    ctx.lineTo(cx, cy + armY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - armX, cy);
    ctx.lineTo(cx + armX, cy);
    ctx.stroke();
  }
}

function drawSleeveCurtains(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  appearance: StageExportAppearance
) {
  const marks = buildSleeveCurtainMarksFromCurtains(
    appearance.stageSleeveCurtains,
    appearance.Dmm,
    appearance.Wmm,
    appearance.Smm
  );
  if (marks.length === 0) return;

  const thicknessPx = Math.max(6, (1.1 / 100) * main.h);

  for (const m of marks) {
    const showLeft = m.side === "both" || m.side === "left";
    const showRight = m.side === "both" || m.side === "right";
    const visualWidthPct = Math.max(m.wingPct + m.insetPct, 0.8);
    const w = (visualWidthPct / 100) * main.w;
    const y = main.y + (m.yPct / 100) * main.h - thicknessPx / 2;

    const paint = (side: "left" | "right") => {
      const x =
        side === "left"
          ? main.x - (m.wingPct / 100) * main.w
          : main.x + main.w + (m.wingPct / 100) * main.w - w;
      ctx.fillStyle = "rgba(251, 113, 133, 0.38)";
      ctx.strokeStyle = "rgba(251, 113, 133, 0.9)";
      ctx.lineWidth = 1.25;
      const r = 5;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(
          x,
          y,
          w,
          thicknessPx,
          side === "left" ? [0, r, r, 0] : [r, 0, 0, r]
        );
      } else {
        ctx.rect(x, y, w, thicknessPx);
      }
      ctx.fill();
      ctx.stroke();
    };

    if (showLeft) paint("left");
    if (showRight) paint("right");
  }
}

function drawFloorLineMarkup(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  line: StageFloorLineMarkup
) {
  if (line.pointsPct.length < 2) return;
  const color =
    typeof line.color === "string" && line.color.trim()
      ? line.color.trim()
      : "rgba(253, 224, 71, 0.92)";
  const widthPx =
    typeof line.widthPx === "number" && Number.isFinite(line.widthPx)
      ? Math.max(1, Math.min(24, line.widthPx))
      : 3;

  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  line.pointsPct.forEach(([xp, yp], i) => {
    const x = main.x + (xp / 100) * main.w;
    const y = main.y + (yp / 100) * main.h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawFloorTextMarkup(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  m: StageFloorTextMarkup
) {
  if (floorTextLayer(m) === "screen") return;
  const body = m.text;
  if (!body.trim()) return;

  const sc = floorTextMarkupScale(m);
  const fs = Math.max(8, Math.min(56, m.fontSizePx ?? 18));
  const fw =
    Math.round(Math.min(900, Math.max(300, m.fontWeight ?? 600)) / 50) * 50;
  const rotation =
    typeof m.rotation === "number" && Number.isFinite(m.rotation)
      ? m.rotation
      : 0;
  const align = m.textAlign ?? "left";
  const color = floorTextColorHex(m);
  const fontFamily = floorTextFontCss(m);
  const x = main.x + (m.xPct / 100) * main.w;
  const y = main.y + (m.yPct / 100) * main.h;
  const lines = body.split("\n");
  const lineH = fs * 1.25;
  const padX = 6;
  const padY = 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(sc, sc);
  ctx.font = `${fw} ${fs}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";

  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width);
  }
  const boxH = lines.length * lineH + padY * 2;
  const boxW = maxW + padX * 2;
  // CSS の translate(-50%, -50%) 相当：ボックス中心を座標に置く
  const boxX = -boxW / 2;
  const boxY = -boxH / 2;

  if (m.bgColor && m.bgColor.trim()) {
    ctx.fillStyle = m.bgColor.trim();
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }
  }

  ctx.fillStyle = color;
  if (!m.bgColor?.trim()) {
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
  }
  const textX =
    align === "left"
      ? boxX + padX
      : align === "right"
        ? boxX + boxW - padX
        : 0;
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, boxY + padY + i * lineH);
  });
  ctx.restore();
}

function drawFloorMarkupList(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  main: FloorRect,
  items: readonly StageFloorMarkup[] | null | undefined
) {
  if (!items?.length) return;
  for (const m of items) {
    if (m.kind === "line") drawFloorLineMarkup(ctx, main, m);
  }
  for (const m of items) {
    if (m.kind === "text") drawFloorTextMarkup(ctx, main, m);
  }
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

  const { outer, main } = layoutStageExportFrame(width, height, appearance);

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
  drawCenterMarks(ctx, main, appearance);
  drawSleeveCurtains(ctx, main, appearance);
  drawFloorMarkupList(ctx, main, appearance.globalFloorMarkup);
  if (formation) {
    drawFloorMarkupList(ctx, main, formation.floorMarkup);
    drawDancers(ctx, formation, main, appearance);
  }

  ctx.restore();
}

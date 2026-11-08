import { jsPDF } from "jspdf";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatPdfClock } from "./choreographyPdfPages";
import {
  buildLightingPlanDocument,
  drawFormationSketch,
  formationSketchDancers,
  type LightingPlanCueRow,
  type LightingPlanDocument,
} from "./lightingPlan";
import { lightingTextRuns, type LightingTextRun } from "./lightingText";

const PAGE_W = 595;
const PAGE_H = 842;
const SCALE = 2;
const MARGIN = 22;

const FONT =
  '"Noto Sans JP", "Hiragino Sans", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';

function safeFileBase(name: string): string {
  return (
    name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60) ||
    "lighting-plan"
  );
}

type PageCtx = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
};

function createPage(): PageCtx {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("照明プランの用紙を用意できませんでした");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.fillStyle = "#111111";
  ctx.strokeStyle = "#111111";
  ctx.textBaseline = "middle";
  return { ctx, canvas };
}

function wrapToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const part of text.split("\n")) {
    let line = "";
    for (const char of part) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, 3);
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  options?: { fill?: string; bold?: boolean; size?: number; align?: CanvasTextAlign; wrap?: boolean }
) {
  ctx.save();
  if (options?.fill) {
    ctx.fillStyle = options.fill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x + 3, y + 1, Math.max(0, w - 6), Math.max(0, h - 2));
  ctx.clip();
  ctx.fillStyle = "#111111";
  const size = options?.size ?? 10;
  ctx.font = `${options?.bold ? 700 : 400} ${size}px ${FONT}`;
  ctx.textAlign = options?.align ?? "left";
  const align = options?.align ?? "left";
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 4 : x + 4;
  const lines = options?.wrap ? wrapToWidth(ctx, text, Math.max(8, w - 8)) : [text];
  const lineH = Math.ceil(size * 1.15);
  const blockH = lines.length * lineH;
  let ty = y + (h - blockH) / 2;
  ctx.textBaseline = "top";
  for (const line of lines) {
    ctx.fillText(line, tx, ty);
    ty += lineH;
  }
  ctx.restore();
}

function drawHeader(page: PageCtx, doc: LightingPlanDocument, continued: boolean): number {
  const { ctx } = page;
  const left = MARGIN;
  const width = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  if (continued) {
    ctx.save();
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#111111";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${doc.heading}（続き）`, left, y + 12);
    const sub = [doc.className, doc.songTitle].filter(Boolean).join("  /  ");
    if (sub) {
      ctx.font = `400 8px ${FONT}`;
      ctx.fillText(sub, left + 220, y + 12);
    }
    ctx.restore();
    return y + 22;
  }

  const boxH = 22;
  const smallW = 36;
  drawCell(ctx, left, y, 46, boxH, "演目順", { fill: "#f3f4f6", bold: true, align: "center", size: 10 });
  drawCell(ctx, left + 46, y, smallW, boxH, doc.programOrder, { align: "center", size: 16, bold: true });
  drawCell(ctx, left + 82, y, 16, boxH, "－", { align: "center", size: 14 });
  drawCell(ctx, left + 98, y, smallW, boxH, doc.programSub, { align: "center", size: 16, bold: true });
  drawCell(ctx, left + 150, y, 40, boxH, "板付", { fill: "#f3f4f6", bold: true, align: "center", size: 11 });
  drawCell(ctx, left + 190, y, smallW, boxH, doc.presetMark, { align: "center", size: 16, bold: true });
  drawCell(ctx, left + width - 96, y, 52, boxH, "ピンスポ", { fill: "#f3f4f6", bold: true, align: "center", size: 11 });
  drawCell(ctx, left + width - 44, y, 44, boxH, doc.pinSpotLabel, { align: "center", size: 12 });

  y += 30;
  ctx.save();
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#111111";
  ctx.fillText(doc.heading, PAGE_W / 2, y + 16);
  ctx.restore();
  y += 26;

  const c1 = 64;
  const c2 = Math.round(width * 0.34);
  const c3 = 42;
  const c4 = 64;
  const c5 = 40;
  const c6 = width - (c1 + c2 + c3 + c4 + c5);
  const rowH = 26;
  const cells: { w: number; text: string; label?: boolean; size?: number }[] = [
    { w: c1, text: "クラス名", label: true, size: 11 },
    { w: c2, text: doc.className, size: 11 },
    { w: c3, text: "TIME", label: true, size: 11 },
    { w: c4, text: doc.timeLabel, size: 14 },
    { w: c5, text: "人数", label: true, size: 11 },
    { w: c6, text: doc.headcountLabel ? `${doc.headcountLabel} 人` : "", size: 14 },
  ];
  let x = left;
  for (const cell of cells) {
    drawCell(ctx, x, y, cell.w, rowH, cell.text, {
      fill: cell.label ? "#f3f4f6" : undefined,
      bold: Boolean(cell.label || cell.size === 14),
      align: cell.label || cell.size === 14 ? "center" : "left",
      size: cell.size,
      wrap: cell.label,
    });
    x += cell.w;
  }
  y += rowH;

  const songW = c1 + c2;
  drawCell(ctx, left, y, c1, rowH, "使用曲", {
    fill: "#f3f4f6",
    bold: true,
    align: "center",
    size: 11,
    wrap: true,
  });
  drawCell(ctx, left + c1, y, songW - c1, rowH, doc.songTitle, { size: 11 });
  drawCell(ctx, left + songW, y, c3, rowH, "衣装", {
    fill: "#f3f4f6",
    bold: true,
    align: "center",
    size: 11,
  });
  const costume = [
    doc.costumeBottom ? `下－${doc.costumeBottom}` : "",
    doc.costumeTop ? `上－${doc.costumeTop}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  drawCell(ctx, left + songW + c3, y, width - songW - c3, rowH, costume, { size: 11 });
  y += rowH;

  drawCell(ctx, left, y, c1, rowH, "全体の\n雰囲気", {
    fill: "#f3f4f6",
    bold: true,
    align: "center",
    size: 10,
    wrap: true,
  });
  drawCell(ctx, left + c1, y, width - c1, rowH, doc.atmosphere, { size: 11 });
  y += rowH;
  drawCell(ctx, left, y, c1, rowH, "ポイント", {
    fill: "#f3f4f6",
    bold: true,
    align: "center",
    size: 11,
    wrap: true,
  });
  drawCell(ctx, left + c1, y, width - c1, rowH, doc.points, { size: 11 });
  y += rowH + 8;
  return y;
}

/** 参照シートの列比。番号は細く、照明要望が行の大半 */
const COL_NUM = 43;
/** 袖で開始・終了を上下に読める幅。画面の時刻欄とは別 */
const COL_TIME = 82;
/** 説明文は置かず、隊形の絵だけ */
const COL_FORMATION = 105;
/** 参照の照明文は本文。指定した大きさは印の size が優先する */
const LIGHT_FONT = 12;
const TIME_FONT = 18;

function columnWidths() {
  const tableW = PAGE_W - MARGIN * 2;
  return {
    num: COL_NUM,
    time: COL_TIME,
    formation: COL_FORMATION,
    light: tableW - COL_NUM - COL_TIME - COL_FORMATION,
  };
}

const SKETCH_W = 84;

function lightingLines(
  ctx: CanvasRenderingContext2D,
  row: LightingPlanCueRow,
  maxWidth: number
): LightingTextRun[][] {
  const runs = lightingTextRuns(row.lightingRequest, row.lightingRequestMarks, {
    size: LIGHT_FONT,
    color: "#111111",
  });
  const lines: LightingTextRun[][] = [];
  let line: LightingTextRun[] = [];
  let lineW = 0;
  const pushLine = () => {
    if (line.length === 0) line.push({ text: "", bold: false, size: LIGHT_FONT, color: "#111111" });
    lines.push(line);
    line = [];
    lineW = 0;
  };
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) pushLine();
      let rest = part;
      while (rest) {
        ctx.font = `${run.bold ? 700 : 400} ${run.size}px ${FONT}`;
        if (lineW >= maxWidth && line.length > 0) pushLine();
        let fit = rest.length;
        while (fit > 1 && lineW + ctx.measureText(rest.slice(0, fit)).width > maxWidth) {
          fit -= 1;
        }
        const chunk = rest.slice(0, fit);
        line.push({ ...run, text: chunk });
        lineW += ctx.measureText(chunk).width;
        rest = rest.slice(fit);
        if (rest) pushLine();
      }
    });
  }
  if (line.length > 0) lines.push(line);
  return lines.slice(0, 24);
}

function linesHeight(lines: LightingTextRun[][]): number {
  return lines.reduce((sum, line) => {
    const size = Math.max(LIGHT_FONT, ...line.map((run) => run.size));
    return sum + Math.ceil(size * 1.35);
  }, 0);
}

function rowHeight(ctx: CanvasRenderingContext2D, row: LightingPlanCueRow | null): number {
  const cols = columnWidths();
  const lines = row ? lightingLines(ctx, row, cols.light - 10) : [];
  const textH = (lines.length > 0 ? linesHeight(lines) : Math.ceil(LIGHT_FONT * 1.35)) + 16;
  const asked =
    row?.rowHeightPx != null ? Math.round(row.rowHeightPx * (72 / 96)) : 0;
  return Math.max(68, textH, asked);
}

function drawTableHead(ctx: CanvasRenderingContext2D, y: number): number {
  const cols = columnWidths();
  const h = 20;
  let x = MARGIN;
  const heads: { w: number; label: string }[] = [
    { w: cols.num, label: "番号" },
    { w: cols.time, label: "時間" },
    { w: cols.formation, label: "フォーメーション" },
    { w: cols.light, label: "照明 要望等" },
  ];
  for (const head of heads) {
    drawCell(ctx, x, y, head.w, h, head.label, {
      fill: "#f3f4f6",
      bold: true,
      align: "center",
      size: 9,
      wrap: head.label.length > 4,
    });
    x += head.w;
  }
  return y + h;
}

function drawRow(
  page: PageCtx,
  project: ChoreographyProjectJson,
  row: LightingPlanCueRow | null,
  y: number,
  h: number
) {
  const { ctx } = page;
  const cols = columnWidths();
  let x = MARGIN;
  drawCell(ctx, x, y, cols.num, h, row ? String(row.number) : "", {
    align: "center",
    bold: true,
    size: 12,
  });
  x += cols.num;
  drawTimeCell(ctx, x, y, cols.time, h, row);
  x += cols.time;

  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, cols.formation, h);
  ctx.beginPath();
  ctx.rect(x, y, cols.formation, h);
  ctx.clip();
  if (row) {
    const sketchW = SKETCH_W;
    const sketchH = Math.min(Math.max(28, h - 8), Math.round(sketchW * 0.72));
    const sketchX = x + (cols.formation - sketchW) / 2;
    const sketchY = y + (h - sketchH) / 2;
    drawFormationSketch(
      ctx,
      { x: sketchX, y: sketchY, w: sketchW, h: sketchH },
      formationSketchDancers(project, row.formationId)
    );
  }
  ctx.restore();
  x += cols.formation;

  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, cols.light, h);
  ctx.beginPath();
  ctx.rect(x, y, cols.light, h);
  ctx.clip();
  if (row?.lightingRequest) {
    const lines = lightingLines(ctx, row, cols.light - 10);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let cy = y + 8;
    for (const line of lines) {
      if (cy > y + h - 4) break;
      let cx = x + 5;
      const lineH = Math.ceil(Math.max(LIGHT_FONT, ...line.map((run) => run.size)) * 1.35);
      for (const run of line) {
        ctx.font = `${run.bold ? 700 : 400} ${run.size}px ${FONT}`;
        ctx.fillStyle = run.color;
        ctx.fillText(run.text, cx, cy);
        cx += ctx.measureText(run.text).width;
      }
      cy += lineH;
    }
  }
  ctx.restore();
}

/** 袖で読む開始・終了。1行に詰めず、数字を上下に大きく置く */
function drawTimeCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  row: LightingPlanCueRow | null
) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, w, h);
  if (!row) {
    ctx.restore();
    return;
  }
  const start = formatPdfClock(row.tStartSec);
  const end = formatPdfClock(row.tEndSec);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${TIME_FONT}px ${FONT}`;
  ctx.fillText(start, cx, cy - 15);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText("~", cx, cy);
  ctx.font = `700 ${TIME_FONT}px ${FONT}`;
  ctx.fillText(end, cx, cy + 15);
  ctx.restore();
}

export function renderLightingPlanCanvases(
  project: ChoreographyProjectJson
): HTMLCanvasElement[] {
  return paintLightingPlanPages(project, buildLightingPlanDocument(project));
}

function paintLightingPlanPages(
  project: ChoreographyProjectJson,
  doc: LightingPlanDocument
): HTMLCanvasElement[] {
  const pages: PageCtx[] = [];
  let page = createPage();
  pages.push(page);
  let y = drawHeader(page, doc, false);
  y = drawTableHead(page.ctx, y);

  const rows: (LightingPlanCueRow | null)[] = [...doc.rows];
  if (rows.length === 0) rows.push(null);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? null;
    let h = rowHeight(page.ctx, row);
    if (y + h > PAGE_H - MARGIN) {
      page = createPage();
      pages.push(page);
      y = drawHeader(page, doc, true);
      y = drawTableHead(page.ctx, y);
    }
    h = Math.min(h, PAGE_H - MARGIN - y);
    drawRow(page, project, row, y, h);
    y += h;
  }

  const blankH = 36;
  while (y + blankH <= PAGE_H - MARGIN && pages.length === 1 && doc.rows.length < 12) {
    drawRow(page, project, null, y, blankH);
    y += blankH;
  }
  return pages.map((p) => p.canvas);
}

export async function downloadLightingPlanPdf(
  project: ChoreographyProjectJson
): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
    await document.fonts.load('400 11px "Noto Sans JP"');
    await document.fonts.load('700 11px "Noto Sans JP"');
    await document.fonts.load('400 12px "Noto Sans JP"');
    await document.fonts.load('700 12px "Noto Sans JP"');
    await document.fonts.load('700 18px "Noto Sans JP"');
    await document.fonts.load('700 20px "Noto Sans JP"');
    await document.fonts.load('700 40px "Noto Sans JP"');
    await document.fonts.load('700 72px "Noto Sans JP"');
  }
  const doc = buildLightingPlanDocument(project);
  const canvases = renderLightingPlanCanvases(project);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  canvases.forEach((canvas, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W, PAGE_H);
  });
  const base = safeFileBase(doc.songTitle || doc.className || "照明プラン");
  pdf.save(`${base}_照明プラン.pdf`);
}

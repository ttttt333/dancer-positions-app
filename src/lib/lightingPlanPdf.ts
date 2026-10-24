import { jsPDF } from "jspdf";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  buildLightingPlanDocument,
  drawFormationSketch,
  formationSketchDancers,
  type LightingPlanCueRow,
  type LightingPlanDocument,
} from "./lightingPlan";

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

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw || maxWidth <= 0 || maxLines <= 0) return [];
  const paragraphs = raw.split("\n");
  const lines: string[] = [];
  const pushFitted = (source: string) => {
    const chars = [...source];
    let current = "";
    for (const ch of chars) {
      const next = current + ch;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = ch;
      if (lines.length >= maxLines) return;
    }
    if (current) lines.push(current);
  };
  for (const paragraph of paragraphs) {
    if (lines.length >= maxLines) break;
    if (!paragraph) {
      lines.push("");
      continue;
    }
    pushFitted(paragraph);
  }
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  return lines;
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

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  options?: { fill?: string; bold?: boolean; size?: number; align?: CanvasTextAlign }
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
  ctx.font = `${options?.bold ? 700 : 400} ${options?.size ?? 8}px ${FONT}`;
  ctx.textAlign = options?.align ?? "left";
  ctx.textBaseline = "middle";
  const tx =
    options?.align === "center" ? x + w / 2 : options?.align === "right" ? x + w - 4 : x + 4;
  ctx.fillText(text, tx, y + h / 2);
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

  const boxH = 16;
  const smallW = 36;
  drawCell(ctx, left, y, 42, boxH, "演目順", { fill: "#f3f4f6", bold: true, align: "center" });
  drawCell(ctx, left + 42, y, smallW, boxH, doc.programOrder, { align: "center" });
  drawCell(ctx, left + 78, y, 16, boxH, "－", { align: "center" });
  drawCell(ctx, left + 94, y, smallW, boxH, doc.programSub, { align: "center" });
  drawCell(ctx, left + 146, y, 36, boxH, "板付", { fill: "#f3f4f6", bold: true, align: "center" });
  drawCell(ctx, left + 182, y, smallW, boxH, doc.presetMark, { align: "center" });
  drawCell(ctx, left + 234, y, 48, boxH, "ピンスポ", { fill: "#f3f4f6", bold: true, align: "center" });
  drawCell(ctx, left + 282, y, 42, boxH, doc.pinSpotLabel, { align: "center" });

  y += 28;
  ctx.save();
  ctx.font = `700 14px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#111111";
  ctx.fillText(doc.heading, PAGE_W / 2, y + 12);
  ctx.restore();
  y += 22;

  const c1 = 62;
  const c2 = 150;
  const c3 = 42;
  const c4 = 52;
  const c5 = 36;
  const c6 = width - (c1 + c2 + c3 + c4 + c5);
  const rowH = 16;
  const cells: { w: number; text: string; label?: boolean }[] = [
    { w: c1, text: "クラス名", label: true },
    { w: c2, text: doc.className },
    { w: c3, text: "TIME", label: true },
    { w: c4, text: doc.timeLabel, },
    { w: c5, text: "人数", label: true },
    { w: c6, text: doc.headcountLabel ? `${doc.headcountLabel} 人` : "" },
  ];
  let x = left;
  for (const cell of cells) {
    drawCell(ctx, x, y, cell.w, rowH, cell.text, {
      fill: cell.label ? "#f3f4f6" : undefined,
      bold: cell.label,
      align: cell.label ? "center" : "left",
    });
    x += cell.w;
  }
  y += rowH;

  const songW = 210;
  drawCell(ctx, left, y, c1, rowH, "使用曲", { fill: "#f3f4f6", bold: true, align: "center" });
  drawCell(ctx, left + c1, y, songW - c1, rowH, doc.songTitle);
  drawCell(ctx, left + songW, y, 42, rowH, "衣装", { fill: "#f3f4f6", bold: true, align: "center" });
  const costume = [
    doc.costumeBottom ? `下－${doc.costumeBottom}` : "",
    doc.costumeTop ? `上－${doc.costumeTop}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  drawCell(ctx, left + songW + 42, y, width - songW - 42, rowH, costume);
  y += rowH;

  drawCell(ctx, left, y, c1, rowH, "全体の雰囲気", { fill: "#f3f4f6", bold: true, align: "center", size: 7 });
  drawCell(ctx, left + c1, y, width - c1, rowH, doc.atmosphere);
  y += rowH;
  drawCell(ctx, left, y, c1, rowH, "ポイント", { fill: "#f3f4f6", bold: true, align: "center" });
  drawCell(ctx, left + c1, y, width - c1, rowH, doc.points);
  y += rowH + 8;
  return y;
}

const COL_NUM = 28;
const COL_TIME = 78;

function columnWidths() {
  const tableW = PAGE_W - MARGIN * 2;
  const rest = tableW - COL_NUM - COL_TIME;
  const formation = Math.round(rest * 0.46);
  return {
    num: COL_NUM,
    time: COL_TIME,
    formation,
    light: rest - formation,
  };
}

const SKETCH_W = 70;

function rowHeight(ctx: CanvasRenderingContext2D, row: LightingPlanCueRow | null): number {
  const cols = columnWidths();
  ctx.font = `400 8px ${FONT}`;
  const noteLines = row
    ? wrapLines(
        ctx,
        [row.name, row.note].filter(Boolean).join("\n"),
        cols.formation - SKETCH_W - 14,
        6
      )
    : [];
  const lightLines = row
    ? wrapLines(ctx, row.lightingRequest, cols.light - 8, 6)
    : [];
  const textH = Math.max(noteLines.length, lightLines.length, 1) * 11 + 8;
  return Math.max(48, textH);
}

function drawTableHead(ctx: CanvasRenderingContext2D, y: number): number {
  const cols = columnWidths();
  const h = 16;
  let x = MARGIN;
  const heads: { w: number; label: string }[] = [
    { w: cols.num, label: "番号" },
    { w: cols.time, label: "時間" },
    { w: cols.formation, label: "フォーメーション" },
    { w: cols.light, label: "照明 要望等" },
  ];
  for (const head of heads) {
    drawCell(ctx, x, y, head.w, h, head.label, { fill: "#f3f4f6", bold: true, align: "center" });
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
  drawCell(ctx, x, y, cols.num, h, row ? String(row.number) : "", { align: "center", bold: true });
  x += cols.num;
  drawCell(ctx, x, y, cols.time, h, row?.timeLabel ?? "", { align: "center", size: 8 });
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
    const sketchH = Math.max(28, h - 8);
    drawFormationSketch(
      ctx,
      { x: x + 4, y: y + 4, w: sketchW, h: sketchH },
      formationSketchDancers(project, row.formationId)
    );
    const text = [row.name, row.note].filter(Boolean).join("\n");
    ctx.font = `400 8px ${FONT}`;
    const lines = wrapLines(ctx, text, cols.formation - sketchW - 14, 6);
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, x + sketchW + 8, y + 6 + i * 11);
    });
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
    ctx.font = `400 8px ${FONT}`;
    const lines = wrapLines(ctx, row.lightingRequest, cols.light - 8, 6);
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, x + 4, y + 6 + i * 11);
    });
  }
  ctx.restore();
}

function paintPages(
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
    const h = rowHeight(page.ctx, row);
    if (y + h > PAGE_H - MARGIN) {
      page = createPage();
      pages.push(page);
      y = drawHeader(page, doc, true);
      y = drawTableHead(page.ctx, y);
    }
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
    await document.fonts.load('400 12px "Noto Sans JP"');
    await document.fonts.load('700 14px "Noto Sans JP"');
  }
  const doc = buildLightingPlanDocument(project);
  const canvases = paintPages(project, doc);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  canvases.forEach((canvas, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W, PAGE_H);
  });
  const base = safeFileBase(doc.songTitle || doc.className || "照明プラン");
  pdf.save(`${base}_照明プラン.pdf`);
}

import { jsPDF } from "jspdf";
import {
  buildChoreographyPdfPages,
  type ChoreographyPdfPage,
} from "./choreographyPdfPages";
import { drawStageExportFrame } from "./drawStageExportFrame";
import { buildStageExportAppearance } from "./stageExportAppearance";
import type { ChoreographyProjectJson } from "../types/choreography";

export { buildChoreographyPdfPages } from "./choreographyPdfPages";

/** A4 landscape（pt）— 参考 PDF「無題の振付.pdf」と同じ向き */
const PAGE_W = 842;
const PAGE_H = 595;
const SIDEBAR_W = 96;
const RENDER_SCALE = 2;

function safeFileBase(name: string): string {
  return (
    name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60) ||
    "choreography"
  );
}

function drawPrintPage(
  ctx: CanvasRenderingContext2D,
  page: ChoreographyPdfPage,
  pageIndex: number,
  pageCount: number,
  pieceTitle: string,
  appearance: ReturnType<typeof buildStageExportAppearance>
) {
  const W = PAGE_W * RENDER_SCALE;
  const H = PAGE_H * RENDER_SCALE;
  const side = SIDEBAR_W * RENDER_SCALE;
  const s = RENDER_SCALE;

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, side, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(side, 0, W - side, H);

  ctx.fillStyle = "#6b7280";
  ctx.font = `600 ${11 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("再生時間", 18 * s, 28 * s);

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${16 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.fillText(page.timeLabel, 18 * s, 48 * s);

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${20 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(page.title, side + 28 * s, 24 * s);

  if (pieceTitle.trim()) {
    ctx.fillStyle = "#6b7280";
    ctx.font = `500 ${11 * s}px "Noto Sans JP", system-ui, sans-serif`;
    ctx.fillText(pieceTitle.trim(), side + 28 * s, 50 * s);
  }

  const stageX = side + 20 * s;
  const stageY = 72 * s;
  const stageW = W - side - 40 * s;
  const stageH = H - 120 * s;

  const stageCanvas = document.createElement("canvas");
  stageCanvas.width = Math.max(2, Math.floor(stageW));
  stageCanvas.height = Math.max(2, Math.floor(stageH));
  const stageCtx = stageCanvas.getContext("2d");
  if (!stageCtx) throw new Error("Canvas を初期化できませんでした");

  drawStageExportFrame(
    stageCtx,
    stageCanvas.width,
    stageCanvas.height,
    page.formation.startSec,
    [page.formation],
    {
      ...appearance,
      dancerLabelBelow: true,
      stageGridLinesVertical: true,
      stageGridLinesHorizontal: true,
    },
    0
  );
  ctx.drawImage(stageCanvas, stageX, stageY);

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${13 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("ChoreoCore", side + 28 * s, H - 18 * s);

  ctx.textAlign = "right";
  ctx.fillText(
    String(pageIndex + 1).padStart(2, "0"),
    W - 24 * s,
    H - 18 * s
  );

  ctx.fillStyle = "#9ca3af";
  ctx.font = `500 ${10 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${pageIndex + 1} / ${pageCount}`, (side + W) / 2, H - 18 * s);
}

/**
 * 作品の立ち位置を、参考PDFのようにキュー（またはフォーメーション）ごとに
 * 見やすい印刷用 PDF として書き出す。エディタを開かなくても可。
 */
export async function exportChoreographyPdf(params: {
  project: ChoreographyProjectJson;
  projectName: string;
}): Promise<void> {
  const { project, projectName } = params;
  const pages = buildChoreographyPdfPages(project);
  if (pages.length === 0) {
    throw new Error("書き出すフォーメーションがありません");
  }

  const appearance = buildStageExportAppearance(project);
  const pieceTitle = project.pieceTitle?.trim() || projectName.trim() || "無題の作品";
  const fileBase = safeFileBase(pieceTitle);

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = PAGE_W * RENDER_SCALE;
  pageCanvas.height = PAGE_H * RENDER_SCALE;
  const ctx = pageCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas を初期化できませんでした");

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    drawPrintPage(ctx, page, i, pages.length, pieceTitle, appearance);
    const dataUrl = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage("a4", "landscape");
    doc.addImage(dataUrl, "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
  }

  doc.save(`${fileBase}.pdf`);
}

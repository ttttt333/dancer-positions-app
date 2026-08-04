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
const SIDEBAR_W = 112;
const RENDER_SCALE = 2;

function safeFileBase(name: string): string {
  return (
    name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60) ||
    "choreography"
  );
}

/** 指定幅に収まるよう折り返し（最大 maxLines、超えたら末尾を…） */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw || maxWidth <= 0 || maxLines <= 0) return [];

  const ell = "…";
  const fit = (s: string): string => {
    if (ctx.measureText(s).width <= maxWidth) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(s.slice(0, mid) + ell).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return (s.slice(0, Math.max(0, lo)) + ell).trimEnd() || ell;
  };

  const chars = [...raw];
  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < chars.length; i++) {
    const next = current + chars[i];
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (!current) {
      // 1文字でも幅超過 → 省略して終了
      lines.push(fit(chars[i]!));
      return lines.slice(0, maxLines);
    }
    lines.push(current);
    current = chars[i]!;
    if (lines.length === maxLines) {
      const rest = current + chars.slice(i + 1).join("");
      lines[maxLines - 1] = fit(lines[maxLines - 1]! + rest);
      return lines;
    }
  }
  if (current) {
    if (lines.length >= maxLines) {
      lines[maxLines - 1] = fit(lines[maxLines - 1]! + current);
    } else {
      lines.push(current);
    }
  }
  return lines.slice(0, maxLines);
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
  const contentLeft = side + 24 * s;
  const contentRight = W - 24 * s;
  const titleMaxW = contentRight - contentLeft;

  ctx.fillStyle = "#eef1f5";
  ctx.fillRect(0, 0, side, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(side, 0, W - side, H);

  // サイドバー: 再生時間
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 ${11 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("再生時間", 16 * s, 28 * s);

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${15 * s}px "Noto Sans JP", system-ui, sans-serif`;
  const timeLines = wrapTextLines(ctx, page.timeLabel, side - 28 * s, 2);
  timeLines.forEach((line, i) => {
    ctx.fillText(line, 16 * s, (48 + i * 20) * s);
  });

  // ヘッダー: タイトル（折り返し）+ 作品名
  ctx.fillStyle = "#111827";
  ctx.font = `700 ${18 * s}px "Noto Sans JP", system-ui, sans-serif`;
  const titleLines = wrapTextLines(ctx, page.title, titleMaxW, 2);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, contentLeft, (20 + i * 22) * s);
  });

  const titleBlockH = Math.max(1, titleLines.length) * 22 * s;
  const subY = 20 * s + titleBlockH + 4 * s;
  if (pieceTitle.trim()) {
    ctx.fillStyle = "#6b7280";
    ctx.font = `500 ${11 * s}px "Noto Sans JP", system-ui, sans-serif`;
    const subLines = wrapTextLines(ctx, pieceTitle.trim(), titleMaxW, 1);
    subLines.forEach((line) => {
      ctx.fillText(line, contentLeft, subY);
    });
  }

  const headerBottom = subY + (pieceTitle.trim() ? 18 * s : 0);
  const stageTop = Math.max(headerBottom + 12 * s, 72 * s);
  const footerH = 36 * s;
  const stageX = side + 16 * s;
  const stageY = stageTop;
  const stageW = W - side - 32 * s;
  const stageH = H - stageY - footerH;

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
      stageGridLinesVertical: false,
      stageGridLinesHorizontal: false,
      printFriendlyGrid: true,
    },
    0
  );
  ctx.drawImage(stageCanvas, stageX, stageY);

  // フッター
  ctx.fillStyle = "#111827";
  ctx.font = `700 ${12 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("ChoreoCore", contentLeft, H - 14 * s);

  ctx.textAlign = "right";
  ctx.fillText(
    String(pageIndex + 1).padStart(2, "0"),
    contentRight,
    H - 14 * s
  );

  ctx.fillStyle = "#9ca3af";
  ctx.font = `500 ${10 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${pageIndex + 1} / ${pageCount}`, (side + W) / 2, H - 14 * s);
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

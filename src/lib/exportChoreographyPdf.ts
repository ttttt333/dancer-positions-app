import { jsPDF } from "jspdf";
import { zipSync } from "fflate";
import {
  buildChoreographyPdfPages,
  type ChoreographyPdfLabels,
  type ChoreographyPdfPage,
} from "./choreographyPdfPages";
import { drawStageExportFrame } from "./drawStageExportFrame";
import {
  buildStageExportAppearance,
  type StageExportAppearance,
} from "./stageExportAppearance";
import type { ChoreographyProjectJson } from "../types/choreography";

export { buildChoreographyPdfPages } from "./choreographyPdfPages";

export type ExportChoreographyPdfLabels = ChoreographyPdfLabels & {
  playbackTime: string;
  untitled: string;
  backstage: string;
  side: string;
  audience: string;
  emptyError: string;
};

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

/** ZIP 内ファイル名用（ページ番号 + 短いタイトル） */
export function cueImageFileName(pageIndex: number, pageTitle: string): string {
  const n = String(pageIndex + 1).padStart(2, "0");
  const slug = safeFileBase(pageTitle).slice(0, 40);
  return `${n}-${slug || "cue"}.png`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** fflate の Uint8Array が BlobPart と厳密一致しない環境向け */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG の生成に失敗しました"))),
      "image/png"
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
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
  appearance: StageExportAppearance,
  playbackTimeLabel: string
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

  ctx.fillStyle = "#6b7280";
  ctx.font = `600 ${11 * s}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(playbackTimeLabel, 16 * s, 28 * s);

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${15 * s}px "Noto Sans JP", system-ui, sans-serif`;
  const timeLines = wrapTextLines(ctx, page.timeLabel, side - 28 * s, 2);
  timeLines.forEach((line, i) => {
    ctx.fillText(line, 16 * s, (48 + i * 20) * s);
  });

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

type PreparedExport = {
  pages: ChoreographyPdfPage[];
  appearance: StageExportAppearance;
  pieceTitle: string;
  fileBase: string;
  playbackTime: string;
};

function prepareChoreographyExport(params: {
  project: ChoreographyProjectJson;
  projectName: string;
  labels?: Partial<ExportChoreographyPdfLabels>;
  /** 画像／PDF に含めるキュー id（未指定ならすべて） */
  cueIds?: readonly string[];
}): PreparedExport {
  const { project, projectName, labels = {}, cueIds } = params;
  const pdfLabels: ChoreographyPdfLabels = {
    cueN: labels.cueN ?? ((n) => `キュー ${n}`),
    formationN: labels.formationN ?? ((n) => `フォーメーション ${n}`),
    formationFallback: labels.formationFallback ?? "フォーメーション",
  };
  const playbackTime = labels.playbackTime ?? "再生時間";
  const untitled = labels.untitled ?? "無題の作品";
  const emptyError =
    labels.emptyError ?? "書き出すフォーメーションがありません";

  const pages = buildChoreographyPdfPages(
    project,
    pdfLabels,
    cueIds != null ? { cueIds } : undefined
  );
  if (pages.length === 0) {
    throw new Error(emptyError);
  }

  const appearance: StageExportAppearance = {
    ...buildStageExportAppearance(project),
    stageLabels: {
      backstage: labels.backstage ?? "舞台裏",
      side: labels.side ?? "サイド",
      audience: labels.audience ?? "客席",
    },
  };
  const pieceTitle =
    project.pieceTitle?.trim() || projectName.trim() || untitled;
  return {
    pages,
    appearance,
    pieceTitle,
    fileBase: safeFileBase(pieceTitle),
    playbackTime,
  };
}

/**
 * 作品の立ち位置を、参考PDFのようにキュー（またはフォーメーション）ごとに
 * 見やすい印刷用 PDF として書き出す。エディタを開かなくても可。
 */
export async function exportChoreographyPdf(params: {
  project: ChoreographyProjectJson;
  projectName: string;
  labels?: Partial<ExportChoreographyPdfLabels>;
}): Promise<void> {
  const prepared = prepareChoreographyExport(params);
  const { pages, appearance, pieceTitle, fileBase, playbackTime } = prepared;

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
    drawPrintPage(
      ctx,
      page,
      i,
      pages.length,
      pieceTitle,
      appearance,
      playbackTime
    );
    const dataUrl = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage("a4", "landscape");
    doc.addImage(dataUrl, "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
  }

  doc.save(`${fileBase}.pdf`);
}

/**
 * PDF と同じレイアウトのキュー図を PNG で書き出す。
 * 1 ページなら単体 PNG、複数なら ZIP。
 */
export async function exportChoreographyImages(params: {
  project: ChoreographyProjectJson;
  projectName: string;
  labels?: Partial<ExportChoreographyPdfLabels>;
  /** 含めるキュー id。未指定ならすべて */
  cueIds?: readonly string[];
}): Promise<void> {
  const prepared = prepareChoreographyExport(params);
  const { pages, appearance, pieceTitle, fileBase, playbackTime } = prepared;

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = PAGE_W * RENDER_SCALE;
  pageCanvas.height = PAGE_H * RENDER_SCALE;
  const ctx = pageCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas を初期化できませんでした");

  if (pages.length === 1) {
    const page = pages[0]!;
    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    drawPrintPage(ctx, page, 0, 1, pieceTitle, appearance, playbackTime);
    const bytes = await canvasToPngBytes(pageCanvas);
    downloadBlob(bytesToBlob(bytes, "image/png"), cueImageFileName(0, page.title));
    return;
  }

  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    drawPrintPage(
      ctx,
      page,
      i,
      pages.length,
      pieceTitle,
      appearance,
      playbackTime
    );
    files[cueImageFileName(i, page.title)] = await canvasToPngBytes(pageCanvas);
  }

  const zipped = zipSync(files, { level: 6 });
  downloadBlob(bytesToBlob(zipped, "application/zip"), `${fileBase}-cues.zip`);
}

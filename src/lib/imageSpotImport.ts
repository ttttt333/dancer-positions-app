import type { CrewMember } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";

export type OcrSpotRow = {
  /** UI 用の一時 id */
  rowId: string;
  /** チェック ON で取り込み */
  selected: boolean;
  label: string;
  xPct: number;
  yPct: number;
  confidence: number;
};

export type ImageSpotImportCommit = {
  /** 新規名簿の名前 */
  crewName: string;
  /** 名簿メンバーとステージ座標（同一順） */
  rows: { member: CrewMember; xPct: number; yPct: number }[];
};

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.min(97, Math.max(3, v));
}

function bboxCenterPct(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  iw: number,
  ih: number
): { xPct: number; yPct: number } {
  const cx = (bbox.x0 + bbox.x1) / 2;
  const cy = (bbox.y0 + bbox.y1) / 2;
  return {
    xPct: clampPct((cx / iw) * 100),
    yPct: clampPct((cy / ih) * 100),
  };
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[|"'`]/g, "")
    .trim();
}

/** 明らかなノイズを除外 */
function isPlausibleLabel(s: string): boolean {
  if (s.length < 1 || s.length > 40) return false;
  if (/^[\d\s.,:;\-_/\\]+$/.test(s)) return false;
  return true;
}

type LineLike = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type WordLike = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

function collectLinesFromPage(page: {
  lines?: LineLike[] | null;
  blocks?: {
    paragraphs?: { lines?: LineLike[] | null }[] | null;
  }[] | null;
}): LineLike[] {
  if (page.lines?.length) return page.lines;
  const out: LineLike[] = [];
  for (const b of page.blocks ?? []) {
    for (const para of b.paragraphs ?? []) {
      for (const ln of para.lines ?? []) out.push(ln);
    }
  }
  return out;
}

function collectWordsFromPage(page: {
  words?: WordLike[] | null;
}): WordLike[] {
  return page.words ?? [];
}

/** 長辺がこれ未満なら拡大してから OCR（小さい文字の認識が安定しやすい） */
const OCR_TARGET_MIN_LONG_EDGE = 2400;
/** メモリ・時間の上限（長辺 px） */
const OCR_MAX_LONG_EDGE = 6000;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を開けませんでした。"));
    img.src = src;
  });
}

/**
 * 拡大（小画像時）・グレースケール・軽いコントラストで OCR 向けに整える。
 * 戻り値の w/h は canvas 上のサイズ＝Tesseract の bbox 座標系と一致。
 */
async function preprocessImageForOcr(file: File): Promise<{
  blob: Blob;
  w: number;
  h: number;
}> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(url);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w < 8 || h < 8) throw new Error("画像が小さすぎます。");
    const long = Math.max(w, h);
    let scale = 1;
    if (long < OCR_TARGET_MIN_LONG_EDGE) {
      scale = OCR_TARGET_MIN_LONG_EDGE / long;
    }
    const maxScale = OCR_MAX_LONG_EDGE / long;
    if (scale > maxScale) scale = maxScale;
    const nw = Math.max(8, Math.round(w * scale));
    const nh = Math.max(8, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas が使えません。");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, nw, nh);
    const id = ctx.getImageData(0, 0, nw, nh);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const v = Math.min(255, Math.max(0, (lum - 128) * 1.22 + 128));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("画像の変換に失敗しました。"))),
        "image/png"
      );
    });
    return { blob, w: nw, h: nh };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ingestPageIntoSeen(
  page: {
    lines?: LineLike[] | null;
    blocks?: {
      paragraphs?: { lines?: LineLike[] | null }[] | null;
    }[] | null;
    words?: WordLike[] | null;
  },
  iw: number,
  ih: number,
  seen: Map<string, OcrSpotRow>,
  minConfidence: number,
  useWordsFallback: boolean
): void {
  const push = (text: string, confidence: number, bbox: LineLike["bbox"]) => {
    const label = cleanLabel(text);
    if (!isPlausibleLabel(label)) return;
    if (confidence < minConfidence) return;
    const { xPct, yPct } = bboxCenterPct(bbox, iw, ih);
    const key = `${Math.round(xPct / 2)}:${Math.round(yPct / 2)}:${label.slice(0, 12)}`;
    const prev = seen.get(key);
    if (!prev || prev.confidence < confidence) {
      seen.set(key, {
        rowId: crypto.randomUUID(),
        selected: true,
        label,
        xPct,
        yPct,
        confidence,
      });
    }
  };

  for (const ln of collectLinesFromPage(page)) {
    const t = (ln.text ?? "").trim();
    if (t) push(t, ln.confidence ?? 0, ln.bbox);
  }
  if (useWordsFallback) {
    for (const w of collectWordsFromPage(page)) {
      const t = (w.text ?? "").trim();
      if (t.length >= 1) push(t, w.confidence ?? 0, w.bbox);
    }
  }
}

/**
 * 画像ファイルのピクセルサイズを取得（OCR 座標と同じ基準）。
 */
export function readImageNaturalSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w < 8 || h < 8) {
        reject(new Error("画像が小さすぎます。"));
        return;
      }
      resolve({ w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    img.src = url;
  });
}

/**
 * Tesseract で画像から文字と位置を推定し、立ち位置候補にする。
 */
export async function runImageSpotOcr(
  file: File,
  opts?: {
    onProgress?: (ratio01: number) => void;
  }
): Promise<{ iw: number; ih: number; rows: OcrSpotRow[] }> {
  const { blob, w: iw, h: ih } = await preprocessImageForOcr(file);
  const { createWorker, PSM } = await import("tesseract.js");
  let recognizePhase = 0;
  const worker = await createWorker("jpn+eng", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const base = recognizePhase * 0.5;
        opts?.onProgress?.(Math.min(0.99, base + m.progress * 0.5));
      }
    },
  });
  try {
    const seen = new Map<string, OcrSpotRow>();

    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.AUTO),
      user_defined_dpi: "360",
      preserve_interword_spaces: "1",
    });
    const { data: dataAuto } = await worker.recognize(blob);
    ingestPageIntoSeen(dataAuto, iw, ih, seen, 26, false);
    if (seen.size < 2) {
      ingestPageIntoSeen(dataAuto, iw, ih, seen, 22, true);
    }

    if (seen.size < 4) {
      await worker.setParameters({
        tessedit_pageseg_mode: String(PSM.SPARSE_TEXT),
        user_defined_dpi: "360",
      });
      recognizePhase = 1;
      const { data: dataSparse } = await worker.recognize(blob);
      ingestPageIntoSeen(dataSparse, iw, ih, seen, 22, seen.size < 2);
    }

    opts?.onProgress?.(1);

    const rows = [...seen.values()].sort((a, b) => a.yPct - b.yPct || a.xPct - b.xPct);
    const cap = 64;
    return { iw, ih, rows: rows.slice(0, cap) };
  } finally {
    await worker.terminate();
  }
}

const LABEL_MAX = 16;

export function buildCommitFromRows(
  crewName: string,
  rows: OcrSpotRow[]
): ImageSpotImportCommit | null {
  const picked = rows.filter((r) => r.selected && r.label.trim());
  if (picked.length === 0) return null;
  const out: ImageSpotImportCommit["rows"] = [];
  let color = 0;
  for (const r of picked) {
    const label = r.label.trim().slice(0, LABEL_MAX);
    const member: CrewMember = {
      id: crypto.randomUUID(),
      label,
      colorIndex: modDancerColorIndex(color),
    };
    color++;
    out.push({
      member,
      xPct: clampPct(r.xPct),
      yPct: clampPct(r.yPct),
    });
  }
  return { crewName: crewName.trim() || "画像取込", rows: out };
}

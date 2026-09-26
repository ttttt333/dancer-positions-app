import { VIEWER_NAME_AUTO_FIT_MIN } from "./viewerMarkerDisplay";

export type ViewerLabelFitDancer = {
  xPct: number;
  yPct: number;
  label: string;
};

export type ViewerLabelFitInput = {
  dancers: readonly ViewerLabelFitDancer[];
  floorW: number;
  floorH: number;
  markerPx: number;
  /** 自動縮小前の名下フォント（px） */
  nameFontPx: number;
  labelOffsetPx: number;
  maxLabelWidthPx?: number;
};

type LabelBox = { left: number; top: number; right: number; bottom: number };

function approxLabelWidthPx(
  label: string,
  fontPx: number,
  maxWidth: number
): number {
  const chars = Math.max(1, label.trim().length || 1);
  // 日本語はやや幅広。英数字は狭めに見積もる
  const unit = /[^\u0000-\u00ff]/.test(label) ? 0.92 : 0.58;
  return Math.min(maxWidth, Math.max(fontPx * 1.2, chars * fontPx * unit));
}

function labelBoxAt(
  d: ViewerLabelFitDancer,
  floorW: number,
  floorH: number,
  fontPx: number,
  labelOffsetPx: number,
  maxWidth: number
): LabelBox {
  const cx = (d.xPct / 100) * floorW;
  const cy = (d.yPct / 100) * floorH + labelOffsetPx;
  const w = approxLabelWidthPx(d.label, fontPx, maxWidth);
  const h = fontPx * 1.15;
  return {
    left: cx - w / 2,
    right: cx + w / 2,
    top: cy - h / 2,
    bottom: cy + h / 2,
  };
}

function boxesOverlap(a: LabelBox, b: LabelBox, pad = 1): boolean {
  return !(
    a.right + pad < b.left ||
    b.right + pad < a.left ||
    a.bottom + pad < b.top ||
    b.bottom + pad < a.top
  );
}

function countOverlaps(boxes: readonly LabelBox[]): number {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i]!, boxes[j]!)) n += 1;
    }
  }
  return n;
}

/**
 * 名下ラベル同士の重なりが減るまでフォント倍率を段階的に下げる。
 * 返り値は 1（縮小不要）〜 VIEWER_NAME_AUTO_FIT_MIN。
 */
export function computeViewerNameOverlapFitScale(
  input: ViewerLabelFitInput
): number {
  const {
    dancers,
    floorW,
    floorH,
    nameFontPx,
    labelOffsetPx,
    maxLabelWidthPx = 120,
  } = input;
  if (
    dancers.length < 2 ||
    !(floorW > 40) ||
    !(floorH > 40) ||
    !(nameFontPx >= 6)
  ) {
    return 1;
  }

  // 人数が多いときは少し小さめから始める
  let scale = 1;
  if (dancers.length >= 20) scale = 0.78;
  else if (dancers.length >= 14) scale = 0.86;
  else if (dancers.length >= 10) scale = 0.92;

  for (let step = 0; step < 12; step++) {
    const font = Math.max(6, nameFontPx * scale);
    const boxes = dancers.map((d) =>
      labelBoxAt(d, floorW, floorH, font, labelOffsetPx, maxLabelWidthPx)
    );
    if (countOverlaps(boxes) === 0) {
      return Math.round(scale * 100) / 100;
    }
    const next = scale * 0.88;
    if (next < VIEWER_NAME_AUTO_FIT_MIN) {
      return VIEWER_NAME_AUTO_FIT_MIN;
    }
    scale = next;
  }
  return Math.max(
    VIEWER_NAME_AUTO_FIT_MIN,
    Math.round(scale * 100) / 100
  );
}

/** テスト・デバッグ用: 指定スケールでの重なり数 */
export function countViewerNameLabelOverlaps(
  input: ViewerLabelFitInput,
  scale: number
): number {
  const font = Math.max(6, input.nameFontPx * scale);
  const boxes = input.dancers.map((d) =>
    labelBoxAt(
      d,
      input.floorW,
      input.floorH,
      font,
      input.labelOffsetPx,
      input.maxLabelWidthPx ?? 120
    )
  );
  return countOverlaps(boxes);
}

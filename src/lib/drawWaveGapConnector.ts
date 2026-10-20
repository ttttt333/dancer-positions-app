/**
 * キュー間（移動区間）のコレオグラフィック風カーブ × を描画する。
 * 直線のバッテンより「間の動線」だと分かりやすく、背景はほぼ透明。
 */

export type WaveGapConnectorStyle = {
  /** ほぼ透明な下地（選択時・設定済み時のみわずかに色を乗せる） */
  fillStyle: string;
  strokeStyle: string;
  /** × の線色 */
  crossStyle: string;
  lineWidth: number;
};

/** 下地をほぼ透明にし、カーブ × でキュー間を示す */
export function resolveWaveGapConnectorStyle(opts: {
  ownedBySelection: boolean;
  configuredGapMovement: boolean;
  waveBitmapPxPerCssPx: number;
}): WaveGapConnectorStyle {
  const lw = Math.max(1.35, opts.waveBitmapPxPerCssPx * 1.15);
  if (opts.ownedBySelection) {
    return {
      fillStyle: "rgba(220, 38, 38, 0.1)",
      strokeStyle: "rgba(248, 113, 113, 0.55)",
      crossStyle: "rgba(254, 202, 202, 0.92)",
      lineWidth: lw * 1.08,
    };
  }
  if (opts.configuredGapMovement) {
    return {
      fillStyle: "rgba(185, 28, 28, 0.38)",
      strokeStyle: "rgba(239, 68, 68, 0.9)",
      crossStyle: "rgba(254, 202, 202, 1)",
      lineWidth: lw * 1.18,
    };
  }
  return {
    fillStyle: "rgba(248, 250, 252, 0.02)",
    strokeStyle: "rgba(248, 250, 252, 0.14)",
    crossStyle: "rgba(226, 232, 240, 0.42)",
    lineWidth: lw,
  };
}

/**
 * コレオグラフィックな曲線バッテン（2本の S 字ベジェが交差）。
 */
export function drawChoreographicGapCross(
  g: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  style: Pick<WaveGapConnectorStyle, "crossStyle" | "lineWidth">
): void {
  if (width < 12 || height < 12) return;
  const padX = Math.min(width, height) * 0.2;
  const padY = Math.min(width, height) * 0.18;
  const x0 = left + padX;
  const x1 = left + width - padX;
  const y0 = top + padY;
  const y1 = top + height - padY;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const bulge = Math.min(width, height) * 0.28;

  g.save();
  g.strokeStyle = style.crossStyle;
  g.lineWidth = style.lineWidth;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  /** ＼ 方向のカーブ */
  g.moveTo(x0, y0);
  g.bezierCurveTo(
    cx - bulge * 0.15,
    cy - bulge,
    cx + bulge * 0.15,
    cy + bulge,
    x1,
    y1
  );
  /** ／ 方向のカーブ（逆位相で交差感） */
  g.moveTo(x1, y0);
  g.bezierCurveTo(
    cx + bulge * 0.15,
    cy - bulge,
    cx - bulge * 0.15,
    cy + bulge,
    x0,
    y1
  );
  g.stroke();
  g.restore();
}

export function drawWaveGapConnectorBand(
  g: CanvasRenderingContext2D,
  bounds: { left: number; top: number; width: number; height: number },
  style: WaveGapConnectorStyle
): void {
  const { left, top, width, height } = bounds;
  g.fillStyle = style.fillStyle;
  g.fillRect(left, top, width, height);
  g.strokeStyle = style.strokeStyle;
  g.lineWidth = 1;
  g.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
  drawChoreographicGapCross(g, left, top, width, height, style);
}

/**
 * Canvas 上にセクション色帯を薄く描画（React セクションバーと同一 view で同期）。
 */

import type { MusicSectionOverlaySegment } from "../musicSectionOverlay";
import { waveTimeToExtentX } from "../timelineWaveGeometry";

export function drawMusicSectionBands(
  g: CanvasRenderingContext2D,
  segments: MusicSectionOverlaySegment[],
  viewStart: number,
  viewSpan: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!segments.length || !(viewSpan > 0) || canvasWidth <= 0) return;
  const viewEnd = viewStart + viewSpan;
  const bandH = Math.max(3, Math.min(10, Math.round(canvasHeight * 0.12)));

  for (const seg of segments) {
    if (seg.endSec <= viewStart || seg.startSec >= viewEnd) continue;
    const x1 = waveTimeToExtentX(
      Math.max(seg.startSec, viewStart),
      viewStart,
      viewSpan,
      canvasWidth
    );
    const x2 = waveTimeToExtentX(
      Math.min(seg.endSec, viewEnd),
      viewStart,
      viewSpan,
      canvasWidth
    );
    const left = Math.min(x1, x2);
    const width = Math.max(1, Math.abs(x2 - x1));
    g.fillStyle = withAlpha(seg.color, 0.22);
    g.fillRect(left, 0, width, bandH);
    // 境界線（React バー端と揃える）
    g.strokeStyle = withAlpha(seg.color, 0.85);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(Math.round(left) + 0.5, 0);
    g.lineTo(Math.round(left) + 0.5, bandH + 2);
    g.stroke();
  }
}

function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("rgba(")) {
    return c.replace(
      /rgba\(([^)]+)\)/,
      (_, inner: string) => {
        const parts = inner.split(",").map((p) => p.trim());
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      }
    );
  }
  if (c.startsWith("rgb(")) {
    return c.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
    const hex =
      c.length === 4
        ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
        : c;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return c;
}

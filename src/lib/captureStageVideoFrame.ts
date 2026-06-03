import { toCanvas } from "html-to-image";
import { getStageExportElement } from "./captureStagePng";

const EXPORT_BG = "#0f0f1a";

/**
 * 表示中の 2D ステージ（#stage-export-root）をキャプチャして書き出し canvas に描画。
 */
export async function captureStageRootToExportCanvas(
  ctx2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number
): Promise<boolean> {
  const el = getStageExportElement();
  if (!el) return false;

  const frameCanvas = await toCanvas(el, {
    pixelRatio: 1,
    cacheBust: true,
    skipFonts: false,
  });

  ctx2d.fillStyle = EXPORT_BG;
  ctx2d.fillRect(0, 0, width, height);

  const scale = Math.min(width / frameCanvas.width, height / frameCanvas.height);
  const dw = frameCanvas.width * scale;
  const dh = frameCanvas.height * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx2d.drawImage(frameCanvas, dx, dy, dw, dh);
  return true;
}

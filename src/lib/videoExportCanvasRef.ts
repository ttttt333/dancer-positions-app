import { createRef, type RefObject } from "react";

/** レイアウト切替後も維持する書き出し用キャンバス */
export const videoExportCanvasRef: RefObject<HTMLCanvasElement | null> =
  createRef<HTMLCanvasElement>();

export function getVideoExportCanvasRef(): RefObject<HTMLCanvasElement | null> {
  return videoExportCanvasRef;
}

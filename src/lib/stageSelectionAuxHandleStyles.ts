import type { CSSProperties } from "react";

/** 選択枠まわりの補助ハンドル（緑・青・黄）の共通サイズ */
export const STAGE_AUX_HANDLE_VISUAL_PX = 18;
export const STAGE_AUX_HANDLE_HIT_PX = 44;
/** 選択枠の角から外側へ（緑メニュー・青名前・黄○サイズで共通） */
export const STAGE_AUX_HANDLE_CORNER_OFFSET_PX =
  STAGE_AUX_HANDLE_HIT_PX / 2 + 10;

export function stageAuxHandleHitStyle(
  cursor: string
): CSSProperties {
  return {
    width: STAGE_AUX_HANDLE_HIT_PX,
    height: STAGE_AUX_HANDLE_HIT_PX,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor,
    touchAction: "none",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

export function stageAuxHandleVisualStyle(background: string): CSSProperties {
  return {
    display: "block",
    width: STAGE_AUX_HANDLE_VISUAL_PX,
    height: STAGE_AUX_HANDLE_VISUAL_PX,
    borderRadius: 4,
    background,
    border: "1.5px solid rgba(0,0,0,0.35)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}

/** 選択枠 div の角（left/top/right/bottom: 0）から外側へ同距離 */
export function stageAuxHandleCornerTransform(
  corner: "nw" | "ne" | "se" | "sw"
): string {
  const o = STAGE_AUX_HANDLE_CORNER_OFFSET_PX;
  switch (corner) {
    case "nw":
      return `translate(calc(-50% - ${o}px), calc(-50% - ${o}px))`;
    case "ne":
      return `translate(calc(50% + ${o}px), calc(-50% - ${o}px))`;
    case "se":
      return `translate(calc(50% + ${o}px), calc(50% + ${o}px))`;
    case "sw":
      return `translate(calc(-50% - ${o}px), calc(50% + ${o}px))`;
  }
}

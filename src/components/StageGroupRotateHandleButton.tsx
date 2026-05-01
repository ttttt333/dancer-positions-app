import type { PointerEventHandler } from "react";
import { RotateHandleGlyph } from "./RotateHandleGlyph";

const OFFSET_BELOW_BOX_PX = 32;

export type StageGroupRotateHandleButtonProps = {
  centerXPct: number;
  bottomEdgeYPct: number;
  selectedCount: number;
  borderDeepColor: string;
  rubyColor: string;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
};

/** 複数選択枠の下：枠中心まわりの群回転ハンドル */
export function StageGroupRotateHandleButton({
  centerXPct,
  bottomEdgeYPct,
  selectedCount,
  borderDeepColor,
  rubyColor,
  onPointerDown,
}: StageGroupRotateHandleButtonProps) {
  return (
    <button
      type="button"
      data-group-rotate-handle
      aria-label="選択メンバーを枠の中心まわりに回転（立ち位置と向き）"
      title={`選択中の ${selectedCount} 人を、枠の中心を軸に図形ごと回転（立ち位置と向きが一緒にまわります）`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${centerXPct}%`,
        top: `calc(${bottomEdgeYPct}% + ${OFFSET_BELOW_BOX_PX}px)`,
        transform: "translateX(-50%)",
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: `2px solid ${borderDeepColor}`,
        background: rubyColor,
        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
        cursor: "grab",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: 12,
        padding: 0,
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <RotateHandleGlyph size={17} />
    </button>
  );
}

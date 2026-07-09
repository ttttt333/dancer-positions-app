import type { PointerEventHandler } from "react";
import {
  STAGE_AUX_HANDLE_CORNER_OFFSET_PX,
  stageAuxHandleHitStyle,
} from "../lib/stageSelectionAuxHandleStyles";

export type StageDancerDeleteHandleProps = {
  xPct: number;
  yPct: number;
  facingDeg: number;
  markerPx: number;
  selectedCount: number;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
};

/** 1 人選択時：印の左下のゴミ箱（ドラッグ削除のほかタップでも削除） */
export function StageDancerDeleteHandle({
  xPct,
  yPct,
  facingDeg,
  markerPx,
  selectedCount,
  onPointerDown,
}: StageDancerDeleteHandleProps) {
  const inset = Math.round(markerPx / 2) + 14;
  const o = STAGE_AUX_HANDLE_CORNER_OFFSET_PX;
  const coarsePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  const visualPx = coarsePointer ? 22 : 18;

  return (
    <div
      role="presentation"
      aria-hidden
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: `translate(-50%, -50%) rotate(${facingDeg}deg)`,
        width: 0,
        height: 0,
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        data-dancer-delete-handle
        aria-label={
          selectedCount >= 2
            ? `選択中の ${selectedCount} 人を削除`
            : "この立ち位置を削除"
        }
        title="削除"
        onPointerDown={onPointerDown}
        style={{
          position: "absolute",
          left: `calc(50% - ${inset}px - ${o}px)`,
          top: `calc(50% + ${inset}px + ${o}px)`,
          transform: "translate(-50%, -50%)",
          zIndex: 15,
          ...stageAuxHandleHitStyle("pointer"),
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.95)",
          border: "1.5px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
          color: "#fff",
          touchAction: "manipulation",
        }}
      >
        <svg
          width={visualPx}
          height={visualPx}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

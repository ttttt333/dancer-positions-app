import type { PointerEvent as ReactPointerEvent } from "react";
import { shell } from "../theme/choreoShell";
import {
  GROUP_BOX_HANDLES,
  type GroupBoxHandle,
} from "../lib/stageBoardModelHelpers";

export type StageGroupBoundsPct = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type StageGroupSelectionBoxProps = {
  box: StageGroupBoundsPct;
  /** 円の端から外側にはみ出す分（マーカー半径 + 14px 相当） */
  handleInsetPx: number;
  onHandlePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    h: GroupBoxHandle
  ) => void;
};

/** 複数選択の点線枠と 8 方向リサイズハンドル */
export function StageGroupSelectionBox({
  box,
  handleInsetPx,
  onHandlePointerDown,
}: StageGroupSelectionBoxProps) {
  const r = handleInsetPx;
  return (
    <div
      aria-label="選択中のダンサー"
      data-group-box
      style={{
        position: "absolute",
        left: `calc(${box.x0}% - ${r}px)`,
        top: `calc(${box.y0}% - ${r}px)`,
        width: `calc(${Math.max(0.01, box.x1 - box.x0)}% + ${r * 2}px)`,
        height: `calc(${Math.max(0.01, box.y1 - box.y0)}% + ${r * 2}px)`,
        border: `1px dashed ${shell.ruby}`,
        borderRadius: 4,
        background: "rgba(220, 38, 38, 0.05)",
        pointerEvents: "none",
        zIndex: 6,
        boxSizing: "border-box",
      }}
    >
      {GROUP_BOX_HANDLES.map(({ h, cursor, pos }) => (
        <div
          key={h}
          data-group-box-handle={h}
          role="presentation"
          aria-hidden
          title={`群のリサイズ（${h}）${
            h === "n" || h === "s" || h === "e" || h === "w"
              ? "・Shift で比率保持"
              : "・Shift で 1 軸のみ"
          }`}
          onPointerDown={(e) => onHandlePointerDown(e, h)}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: 2,
            background: "#f4f4f5",
            border: "1px solid rgba(0,0,0,0.38)",
            zIndex: 7,
            boxSizing: "border-box",
            touchAction: "none",
            pointerEvents: "auto",
            cursor,
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            ...pos,
          }}
        />
      ))}
    </div>
  );
}

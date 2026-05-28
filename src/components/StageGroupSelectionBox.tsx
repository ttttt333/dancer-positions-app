import type { PointerEvent as ReactPointerEvent } from "react";
import { shell } from "../theme/choreoShell";
import {
  GROUP_BOX_HANDLES,
  type GroupBoxHandle,
} from "../lib/stageBoardModelHelpers";

/** 白い角ハンドルの見た目サイズ */
const GROUP_BOX_HANDLE_VISUAL_PX = 18;
/** ドラッグしやすいヒット領域（見た目より大きく） */
const GROUP_BOX_HANDLE_HIT_PX = 44;
/** 右上メニューボタン（NEハンドルのさらに右上） */
const GROUP_MENU_HANDLE_VISUAL_PX = 18;
const GROUP_MENU_HANDLE_HIT_PX = 44;
const GROUP_MENU_OFFSET_PX = GROUP_BOX_HANDLE_HIT_PX / 2 + 10;

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
  /** 緑ボタン：選択メニュー（右クリック相当）を開く */
  onOpenMenuClick?: () => void;
};

/** 複数選択の点線枠と 8 方向リサイズハンドル */
export function StageGroupSelectionBox({
  box,
  handleInsetPx,
  onHandlePointerDown,
  onOpenMenuClick,
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
            width: GROUP_BOX_HANDLE_HIT_PX,
            height: GROUP_BOX_HANDLE_HIT_PX,
            zIndex: 7,
            boxSizing: "border-box",
            touchAction: "none",
            pointerEvents: "auto",
            cursor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            ...pos,
          }}
        >
          <div
            aria-hidden
            style={{
              width: GROUP_BOX_HANDLE_VISUAL_PX,
              height: GROUP_BOX_HANDLE_VISUAL_PX,
              borderRadius: 4,
              background: "#f4f4f5",
              border: "1.5px solid rgba(0,0,0,0.42)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        </div>
      ))}
      {onOpenMenuClick ? (
        <button
          type="button"
          data-group-selection-menu-handle
          aria-label="選択した立ち位置の設定を開く"
          title="複製・表示・並べ替えなど（右クリックメニューと同じ）"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenuClick();
          }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            transform: `translate(calc(50% + ${GROUP_MENU_OFFSET_PX}px), calc(-50% - ${GROUP_MENU_OFFSET_PX}px))`,
            width: GROUP_MENU_HANDLE_HIT_PX,
            height: GROUP_MENU_HANDLE_HIT_PX,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "manipulation",
            pointerEvents: "auto",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "block",
              width: GROUP_MENU_HANDLE_VISUAL_PX,
              height: GROUP_MENU_HANDLE_VISUAL_PX,
              borderRadius: 4,
              background: "#22c55e",
              border: "1.5px solid rgba(0,0,0,0.35)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
              boxSizing: "border-box",
            }}
          />
        </button>
      ) : null}
    </div>
  );
}

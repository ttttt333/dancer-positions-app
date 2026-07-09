import type { PointerEvent as ReactPointerEvent } from "react";
import { shell } from "../theme/choreoShell";
import {
  GROUP_BOX_HANDLES,
  type GroupBoxHandle,
} from "../lib/stageBoardModelHelpers";
import {
  STAGE_AUX_HANDLE_HIT_PX,
  stageAuxHandleCornerTransform,
  stageAuxHandleHitStyle,
  stageAuxHandleVisualStyle,
} from "../lib/stageSelectionAuxHandleStyles";

/** 白い角ハンドルの見た目サイズ */
const GROUP_BOX_HANDLE_VISUAL_PX = 18;
/** ドラッグしやすいヒット領域（見た目より大きく） */
const GROUP_BOX_HANDLE_HIT_PX = 44;

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
  /** 青ハンドル：名下フォントサイズ（○の下モード） */
  onNameBelowFontPointerDown?: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  /** 黄ハンドル：○サイズ */
  onMarkerResizePointerDown?: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  /** 赤ボタン：選択メンバーを削除 */
  onDeleteClick?: () => void;
};

/** 複数選択の点線枠と 8 方向リサイズハンドル */
export function StageGroupSelectionBox({
  box,
  handleInsetPx,
  onHandlePointerDown,
  onOpenMenuClick,
  onNameBelowFontPointerDown,
  onMarkerResizePointerDown,
  onDeleteClick,
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
      {onNameBelowFontPointerDown ? (
        <div
          role="presentation"
          aria-hidden
          data-name-below-font-handle
          onPointerDown={onNameBelowFontPointerDown}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: stageAuxHandleCornerTransform("nw"),
            zIndex: 8,
            ...stageAuxHandleHitStyle("ns-resize"),
          }}
        >
          <span
            aria-hidden
            style={stageAuxHandleVisualStyle("#3b82f6")}
          />
        </div>
      ) : null}
      {onOpenMenuClick ? (
        <button
          type="button"
          data-group-selection-menu-handle
          aria-label="選択した立ち位置の設定を開く"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenuClick();
          }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            transform: stageAuxHandleCornerTransform("ne"),
            zIndex: 8,
            ...stageAuxHandleHitStyle("pointer"),
            touchAction: "manipulation",
          }}
        >
          <span
            aria-hidden
            style={stageAuxHandleVisualStyle("#22c55e")}
          />
        </button>
      ) : null}
      {onMarkerResizePointerDown ? (
        <div
          role="presentation"
          aria-hidden
          data-marker-resize-handle
          onPointerDown={onMarkerResizePointerDown}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            transform: stageAuxHandleCornerTransform("se"),
            zIndex: 8,
            ...stageAuxHandleHitStyle("nwse-resize"),
          }}
        >
          <span
            aria-hidden
            style={stageAuxHandleVisualStyle("#fbbf24")}
          />
        </div>
      ) : null}
      {onDeleteClick ? (
        <button
          type="button"
          data-dancer-delete-handle
          aria-label="選択した立ち位置を削除"
          title="削除"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            transform: stageAuxHandleCornerTransform("sw"),
            zIndex: 8,
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
            width="16"
            height="16"
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
      ) : null}
    </div>
  );
}

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { SetPiece } from "../types/choreography";
import {
  resolveSetPieceFill,
  setPieceKindJa,
  setPieceLayer,
  setPieceRotationDegDisplay,
  type SetPieceResizeHandle,
} from "../lib/stageBoardModelHelpers";
import { RotateHandleGlyph } from "./RotateHandleGlyph";

export type SetPieceBlockProps = {
  piece: SetPiece;
  /** 編集画面ポータル上では床テキストより前面に出す */
  coord?: "stage" | "screen";
  selected: boolean;
  setPiecesEditable: boolean;
  snapGrid: boolean;
  viewMode: "edit" | "view";
  playbackOrPreview: boolean;
  onBodyPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, piece: SetPiece) => void;
  onBodyContextMenu: (e: React.MouseEvent<HTMLButtonElement>, piece: SetPiece) => void;
  onToggleInterpolateInGaps: (piece: SetPiece) => void;
  onResizePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    piece: SetPiece,
    handle: SetPieceResizeHandle
  ) => void;
  onRotatePointerDown: (e: ReactPointerEvent<HTMLButtonElement>, piece: SetPiece) => void;
};

const resizeHandles: {
  h: SetPieceResizeHandle;
  cursor: string;
  pos: CSSProperties;
}[] = [
  { h: "nw", cursor: "nwse-resize", pos: { left: 0, top: 0, transform: "translate(-50%, -50%)" } },
  { h: "n", cursor: "ns-resize", pos: { left: "50%", top: 0, transform: "translate(-50%, -50%)" } },
  { h: "ne", cursor: "nesw-resize", pos: { right: 0, top: 0, transform: "translate(50%, -50%)" } },
  { h: "e", cursor: "ew-resize", pos: { right: 0, top: "50%", transform: "translate(50%, -50%)" } },
  { h: "se", cursor: "nwse-resize", pos: { right: 0, bottom: 0, transform: "translate(50%, 50%)" } },
  { h: "s", cursor: "ns-resize", pos: { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "sw", cursor: "nesw-resize", pos: { left: 0, bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "w", cursor: "ew-resize", pos: { left: 0, top: "50%", transform: "translate(-50%, -50%)" } },
];

export function SetPieceBlock({
  piece: p,
  coord = "stage",
  selected,
  setPiecesEditable,
  snapGrid,
  viewMode,
  playbackOrPreview,
  onBodyPointerDown,
  onBodyContextMenu,
  onToggleInterpolateInGaps,
  onResizePointerDown,
  onRotatePointerDown,
}: SetPieceBlockProps) {
  const fill = resolveSetPieceFill(p);
  const rotDeg = setPieceRotationDegDisplay(p);
  const selectedSp = selected && setPiecesEditable;
  const zBase = coord === "screen" ? 40 : 2;
  const zSelected = coord === "screen" ? 46 : 5;

  return (
    <div
      data-set-piece-id={p.id}
      style={{
        position: "absolute",
        left: `${p.xPct}%`,
        top: `${p.yPct}%`,
        width: `${p.wPct}%`,
        height: `${p.hPct}%`,
        zIndex: selectedSp ? zSelected : zBase,
        boxSizing: "border-box",
        pointerEvents: setPiecesEditable ? "auto" : "none",
        transform: rotDeg !== 0 ? `rotate(${rotDeg}deg)` : undefined,
        transformOrigin: "50% 50%",
      }}
    >
      <button
        type="button"
        aria-label={p.label?.trim() ? p.label : "大道具"}
        title={
          setPiecesEditable
            ? [
                p.label?.trim() || `大道具（${setPieceKindJa(p.kind)}）`,
                setPieceLayer(p) === "screen" ? "編集画面基準（%）" : "メイン床基準（%）",
                "ドラッグで移動",
                "上の丸ハンドルで回転（Shift で15°刻み）",
                "角・辺のハンドルでリサイズ",
                snapGrid ? "Shift+ドラッグで細かいグリッド" : null,
                "Delete / Backspace で削除",
                "右クリックでメニュー",
                "ダブルクリックでキュー間ギャップの補間 ON/OFF",
                p.interpolateInGaps ? "（補間: ON）" : "（補間: OFF）",
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        tabIndex={setPiecesEditable ? 0 : -1}
        onPointerDown={(e) => onBodyPointerDown(e, p)}
        onContextMenu={(e) => {
          if (viewMode === "view" || playbackOrPreview || !setPiecesEditable) return;
          onBodyContextMenu(e, p);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!setPiecesEditable) return;
          onToggleInterpolateInGaps(p);
        }}
        style={{
          position: "absolute",
          inset: 0,
          border:
            selectedSp
              ? "2px solid rgba(251, 191, 36, 0.92)"
              : p.interpolateInGaps
                ? "1px solid rgba(45, 212, 191, 0.72)"
                : "1px solid rgba(148, 163, 184, 0.55)",
          borderRadius: p.kind === "ellipse" ? "999px" : 6,
          background: "rgba(15, 23, 42, 0.2)",
          boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.2)",
          cursor: setPiecesEditable ? "grab" : "default",
          padding: 0,
          margin: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-end",
          textAlign: "left",
          color: "#f1f5f9",
          fontSize: "10px",
          lineHeight: 1.25,
          fontWeight: 600,
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 18,
            pointerEvents: "none",
          }}
        >
          {p.kind === "triangle" ? (
            <div
              style={{
                position: "absolute",
                left: "8%",
                right: "8%",
                top: "6%",
                bottom: "10%",
                clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                WebkitClipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                background: fill,
                opacity: 0.92,
              }}
            />
          ) : p.kind === "ellipse" ? (
            <div
              style={{
                position: "absolute",
                left: "6%",
                right: "6%",
                top: "6%",
                bottom: "6%",
                borderRadius: "50%",
                background: fill,
                opacity: 0.92,
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                left: "6%",
                right: "6%",
                top: "6%",
                bottom: "6%",
                borderRadius: 5,
                background: fill,
                opacity: 0.92,
              }}
            />
          )}
        </div>
        <span
          style={{
            position: "relative",
            zIndex: 1,
            padding: "2px 6px 4px",
            textShadow: "0 0 4px rgba(15,23,42,0.95), 0 1px 2px rgba(0,0,0,0.8)",
            alignSelf: "flex-start",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {p.label?.trim() ? p.label : "大道具"}
        </span>
      </button>
      {selectedSp
        ? resizeHandles.map(({ h, cursor, pos }) => (
            <div
              key={h}
              role="presentation"
              aria-hidden
              title={`リサイズ（${h}）`}
              onPointerDown={(e) => onResizePointerDown(e, p, h)}
              style={{
                position: "absolute",
                width: 11,
                height: 11,
                borderRadius: 2,
                background: "rgba(251, 191, 36, 0.95)",
                border: "1px solid #0f172a",
                zIndex: 6,
                boxSizing: "border-box",
                touchAction: "none",
                cursor,
                ...pos,
              }}
            />
          ))
        : null}
      {selectedSp ? (
        <button
          type="button"
          aria-label="大道具を回転"
          title="ドラッグで回転（Shift で15°刻み）"
          onPointerDown={(e) => onRotatePointerDown(e, p)}
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translate(-50%, calc(-100% - 10px))",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "1px solid #0f172a",
            background: "rgba(59, 130, 246, 0.92)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            margin: 0,
            cursor: "grab",
            zIndex: 7,
            touchAction: "none",
            pointerEvents: "auto",
          }}
        >
          <RotateHandleGlyph size={15} />
        </button>
      ) : null}
    </div>
  );
}

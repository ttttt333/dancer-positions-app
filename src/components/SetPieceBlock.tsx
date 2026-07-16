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
  // ダンサーマーカー(z=4)より常に下に置く。選択中でも z=3 に留める。
  const zBase = coord === "screen" ? 40 : -1;
  const zSelected = coord === "screen" ? 46 : 10;

  return (
    <div
      data-set-piece-id={p.id}
      data-stage-interactive
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
              : "none",
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
            bottom: 0,
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

      </button>
      {selectedSp
        ? resizeHandles.map(({ h, cursor, pos }) => (
            <div
              key={h}
              role="presentation"
              aria-hidden
              data-stage-interactive
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
          data-stage-interactive
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

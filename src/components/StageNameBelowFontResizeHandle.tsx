import type { PointerEventHandler } from "react";

const VISUAL_PX = 16;
const HIT_PX = 40;
/** 白い NW 角ハンドルと重ならないよう外側へ */
const OUTSET_PX = 26;

export type StageNameBelowFontResizeHandleProps = {
  /** 床 pct 座標（選択枠左上 or ダンサー中心） */
  xPct: number;
  yPct: number;
  /** true = xPct/yPct はダンサー中心。false = 選択範囲の左上 */
  anchorIsDancerCenter?: boolean;
  markerPx?: number;
  /** 選択枠の handleInsetPx（範囲選択時） */
  selectionInsetPx?: number;
  selectedCount: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

/** 「名前は○の下」モード：選択範囲左上の青四角。上下ドラッグで名前サイズ変更 */
export function StageNameBelowFontResizeHandle({
  xPct,
  yPct,
  anchorIsDancerCenter = false,
  markerPx = 24,
  selectionInsetPx = 0,
  selectedCount,
  onPointerDown,
}: StageNameBelowFontResizeHandleProps) {
  const bulk = selectedCount >= 2;
  const title = bulk
    ? `選択中 ${selectedCount} 人の名前サイズを変更（上下ドラッグ）`
    : "名前のサイズを変更（上下ドラッグ）";
  const inset = Math.round(markerPx / 2) + 14;
  const boxInset = anchorIsDancerCenter ? inset : selectionInsetPx;
  const left = `calc(${xPct}% - ${boxInset}px - ${OUTSET_PX}px)`;
  const top = `calc(${yPct}% - ${boxInset}px - ${OUTSET_PX}px)`;

  return (
    <div
      role="presentation"
      aria-hidden
      data-name-below-font-handle
      title={title}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left,
        top,
        width: HIT_PX,
        height: HIT_PX,
        transform: "translate(-50%, -50%)",
        cursor: "ns-resize",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: bulk ? 21 : 15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden
        style={{
          width: VISUAL_PX,
          height: VISUAL_PX,
          borderRadius: 4,
          background: "#3b82f6",
          border: "2px solid #0f172a",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

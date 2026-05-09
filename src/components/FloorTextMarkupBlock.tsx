import { useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { StageFloorTextMarkup } from "../types/choreography";
import {
  clamp,
  floorTextColorHex,
  floorTextFontCss,
  floorTextMarkupScale,
  type FloorTextCornerHandle,
} from "../lib/stageBoardModelHelpers";

export type FloorTextTapOrDragPayload = {
  id: string;
  text: string;
  fontSizePx: number;
  fontWeight: number;
  color: string;
  fontFamily: string;
  startClientX: number;
  startClientY: number;
  startXPct: number;
  startYPct: number;
  pointerId: number;
  layer: "stage" | "screen";
};

export type FloorTextResizeDragPayload = {
  id: string;
  anchorX: number;
  anchorY: number;
  startDist: number;
  startScale: number;
  pointerId: number;
};

export type FloorTextDraftPayload = {
  body: string;
  fontSizePx: number;
  fontWeight: number;
  color: string;
  fontFamily: string;
};

/** 複数テキスト一括ドラッグのセッション情報 */
export type FloorTextMultiDragPayload = {
  ids: string[];
  startPositions: Map<string, { xPct: number; yPct: number; layer: "stage" | "screen" }>;
  startClientX: number;
  startClientY: number;
  pointerId: number;
};

/** 回転ドラッグのセッション情報 */
export type FloorTextRotateDragPayload = {
  id: string;
  centerX: number;
  centerY: number;
  startAngleDeg: number;
  startRotation: number;
  pointerId: number;
};

export type FloorTextMarkupBlockProps = {
  markup: StageFloorTextMarkup;
  coordLayer: "stage" | "screen";
  viewMode: "edit" | "view";
  setPiecesEditable: boolean;
  playbackOrPreview: boolean;
  previewDancers: boolean;
  floorTextPlaceSession: unknown | null;
  floorMarkupTool: null | "text" | "line" | "erase";
  selectedFloorTextId: string | null;
  floorTextEditId: string | null;
  floorTextInlineRectId: string | null | undefined;
  floorTextResizeDragRef: MutableRefObject<FloorTextResizeDragPayload | null>;
  floorTextTapOrDragRef: MutableRefObject<FloorTextTapOrDragPayload | null>;
  onContextMenuFloorText: (markupId: string, clientX: number, clientY: number) => void;
  onRemoveFloorMarkup: (id: string) => void;
  onSelectTextMarkupTool: (markupId: string, draft: FloorTextDraftPayload) => void;
  onDoubleClickInlineEdit: (
    markup: StageFloorTextMarkup,
    bounds: DOMRect,
    draft: FloorTextDraftPayload
  ) => void;
  onUpdateTextColor: (id: string, color: string) => void;
  onUpdateTextFontFamily: (id: string, fontFamily: string) => void;
  /** 複数選択中の id 一覧 */
  selectedFloorTextIds?: string[];
  /** Shift+クリックで複数選択 toggle */
  onShiftSelectFloorText?: (id: string) => void;
  /** 複数テキストドラッグ開始用 ref */
  floorTextMultiDragRef?: MutableRefObject<FloorTextMultiDragPayload | null>;
  /** ダブルクリックで右パネル編集シートを開く */
  onOpenTextEditSheet?: (markup: StageFloorTextMarkup, draft: FloorTextDraftPayload) => void;
  /** 回転更新コールバック */
  onUpdateTextRotation?: (id: string, rotation: number) => void;
};

export function FloorTextMarkupBlock({
  markup: m,
  coordLayer,
  viewMode,
  setPiecesEditable,
  playbackOrPreview,
  previewDancers,
  floorTextPlaceSession,
  floorMarkupTool,
  selectedFloorTextId,
  floorTextEditId,
  floorTextInlineRectId,
  floorTextResizeDragRef,
  floorTextTapOrDragRef,
  onContextMenuFloorText,
  onRemoveFloorMarkup,
  onSelectTextMarkupTool,
  onDoubleClickInlineEdit,
  onUpdateTextColor: _onUpdateTextColor,
  onUpdateTextFontFamily: _onUpdateTextFontFamily,
  selectedFloorTextIds,
  onShiftSelectFloorText,
  floorTextMultiDragRef,
  onOpenTextEditSheet,
  onUpdateTextRotation,
}: FloorTextMarkupBlockProps) {
  const rotateDragRef = useRef<FloorTextRotateDragPayload | null>(null);

  const fs = Math.max(8, Math.min(56, m.fontSizePx ?? 18));
  const fw = Math.round(clamp(m.fontWeight ?? 600, 300, 900) / 50) * 50;
  const rotation = m.rotation ?? 0;

  const textHit =
    setPiecesEditable &&
    !playbackOrPreview &&
    !floorTextPlaceSession &&
    (floorMarkupTool === "text" ||
      floorMarkupTool === "erase" ||
      floorMarkupTool === null);

  const textMoveGrab =
    setPiecesEditable &&
    !playbackOrPreview &&
    !floorTextPlaceSession &&
    floorMarkupTool === null;

  const sc = floorTextMarkupScale(m);
  const selected = selectedFloorTextId === m.id;
  const multiSelected = Boolean(selectedFloorTextIds?.includes(m.id));
  const editingInlineHere = floorTextInlineRectId === m.id;

  const showChrome =
    (selected || multiSelected) &&
    textHit &&
    floorMarkupTool !== "erase" &&
    setPiecesEditable &&
    !editingInlineHere;

  const fontCss = floorTextFontCss(m);
  const colorHex = floorTextColorHex(m);

  const draftFromMarkup = (): FloorTextDraftPayload => ({
    body: m.text,
    fontSizePx: Math.round(clamp(m.fontSizePx ?? 18, 8, 56)),
    fontWeight: fw,
    color: colorHex,
    fontFamily: fontCss,
  });

  /* ── リサイズハンドルのドラッグ開始 ── */
  const beginFloorTextResize = (
    ev: ReactPointerEvent<HTMLDivElement>,
    handle: FloorTextCornerHandle,
    boxEl: HTMLDivElement | null
  ) => {
    if (!setPiecesEditable || !boxEl) return;
    ev.preventDefault();
    ev.stopPropagation();
    const rect = boxEl.getBoundingClientRect();
    let ax: number;
    let ay: number;
    if (handle === "se") { ax = rect.left; ay = rect.top; }
    else if (handle === "nw") { ax = rect.right; ay = rect.bottom; }
    else if (handle === "ne") { ax = rect.left; ay = rect.bottom; }
    else { ax = rect.right; ay = rect.top; }
    const d0 = Math.max(14, Math.hypot(ev.clientX - ax, ev.clientY - ay));
    floorTextResizeDragRef.current = {
      id: m.id,
      anchorX: ax,
      anchorY: ay,
      startDist: d0,
      startScale: floorTextMarkupScale(m),
      pointerId: ev.pointerId,
    };
    try { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* noop */ }
  };

  /* ── 回転ハンドルのドラッグ開始 ── */
  const beginRotateDrag = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!setPiecesEditable || !onUpdateTextRotation) return;
    ev.preventDefault();
    ev.stopPropagation();
    const boxEl = (ev.currentTarget as HTMLElement).closest("[data-floor-text-box]") as HTMLElement | null;
    if (!boxEl) return;
    const rect = boxEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngleDeg = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
    rotateDragRef.current = {
      id: m.id,
      centerX: cx,
      centerY: cy,
      startAngleDeg,
      startRotation: rotation,
      pointerId: ev.pointerId,
    };
    try { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* noop */ }
  };

  const handleRotatePointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const rd = rotateDragRef.current;
    if (!rd || ev.pointerId !== rd.pointerId || !onUpdateTextRotation) return;
    ev.preventDefault();
    const currentAngleDeg = Math.atan2(ev.clientY - rd.centerY, ev.clientX - rd.centerX) * (180 / Math.PI);
    const delta = currentAngleDeg - rd.startAngleDeg;
    let newRot = (rd.startRotation + delta) % 360;
    if (newRot < 0) newRot += 360;
    // 15度スナップ (Shift)
    if (ev.shiftKey) newRot = Math.round(newRot / 15) * 15;
    onUpdateTextRotation(rd.id, Math.round(newRot * 10) / 10);
  };

  const handleRotatePointerUp = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (rotateDragRef.current && ev.pointerId === rotateDragRef.current.pointerId) {
      rotateDragRef.current = null;
    }
  };

  const handleCursor = (h: FloorTextCornerHandle) =>
    h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";

  return (
    <div
      data-floor-text-box
      data-floor-markup="text"
      data-fmark-id={m.id}
      title={
        coordLayer === "screen"
          ? "編集画面上のテキスト。タップで選択、ダブルクリックで右パネル編集、ドラッグで移動"
          : textMoveGrab
            ? "タップで選択。ダブルクリックで右パネル編集。ドラッグで移動"
            : floorMarkupTool === "text"
              ? "タップで選択。ダブルクリックで右パネル編集"
              : floorMarkupTool === "erase"
                ? "タップで削除"
                : undefined
      }
      onContextMenu={(e) => {
        if (viewMode === "view" || !setPiecesEditable || playbackOrPreview || previewDancers || !textHit) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenuFloorText(m.id, e.clientX, e.clientY);
      }}
      onDoubleClick={(e) => {
        if (viewMode === "view" || !setPiecesEditable || playbackOrPreview || previewDancers || !textHit || floorMarkupTool === "erase") return;
        e.preventDefault();
        e.stopPropagation();
        // ダブルクリック → 右パネル編集シートを開く
        if (onOpenTextEditSheet) {
          onOpenTextEditSheet(m, draftFromMarkup());
        } else {
          // フォールバック: インライン編集
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          onDoubleClickInlineEdit(m, r, draftFromMarkup());
        }
      }}
      onPointerMove={handleRotatePointerMove}
      onPointerUp={handleRotatePointerUp}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-floor-text-resize-handle]")) return;
        if ((e.target as HTMLElement).closest("[data-floor-text-rotate-handle]")) return;
        if (floorMarkupTool === "erase" && setPiecesEditable) {
          e.preventDefault();
          e.stopPropagation();
          onRemoveFloorMarkup(m.id);
          return;
        }

        if (textMoveGrab) {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          if (e.shiftKey && onShiftSelectFloorText) {
            onShiftSelectFloorText(m.id);
            return;
          }
          if (multiSelected && floorTextMultiDragRef && selectedFloorTextIds && selectedFloorTextIds.length > 1) {
            floorTextMultiDragRef.current = {
              ids: selectedFloorTextIds,
              startPositions: new Map([[m.id, { xPct: m.xPct, yPct: m.yPct, layer: coordLayer }]]),
              startClientX: e.clientX,
              startClientY: e.clientY,
              pointerId: e.pointerId,
            };
            return;
          }
          floorTextTapOrDragRef.current = {
            id: m.id,
            text: m.text,
            fontSizePx: Math.round(clamp(m.fontSizePx ?? 18, 8, 56)),
            fontWeight: fw,
            color: colorHex,
            fontFamily: fontCss,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startXPct: m.xPct,
            startYPct: m.yPct,
            pointerId: e.pointerId,
            layer: coordLayer,
          };
        }
      }}
      style={{
        position: "absolute",
        left: `${m.xPct}%`,
        top: `${m.yPct}%`,
        transform: `translate(-50%, -50%) scale(${sc}) rotate(${rotation}deg)`,
        transformOrigin: "50% 50%",
        maxWidth: coordLayer === "screen" ? "min(42vw, 520px)" : "42%",
        padding: "2px 6px",
        borderRadius: "6px",
        fontSize: fs,
        lineHeight: 1.25,
        fontWeight: fw,
        fontFamily: fontCss,
        color: m.color ?? "#fef3c7",
        background: m.bgColor || "transparent",
        textShadow: m.bgColor ? "none" : "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity: editingInlineHere ? 0 : 1,
        pointerEvents: editingInlineHere ? "none" : textHit ? "auto" : "none",
        cursor:
          floorMarkupTool === "erase" && setPiecesEditable
            ? "pointer"
            : floorMarkupTool === "text" && setPiecesEditable
              ? "pointer"
              : textMoveGrab
                ? "grab"
                : "default",
        boxSizing: "border-box",
      }}
    >
      <span style={{ display: "block" }}>{m.text}</span>

      {/* ── 選択枠（スマートなダッシュボーダー） ── */}
      {showChrome ? (
        <>
          {/* 外枠 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -5,
              border: multiSelected
                ? "1.5px dashed rgba(251,191,36,0.85)"
                : "1.5px dashed rgba(139,92,246,0.9)",
              borderRadius: 7,
              pointerEvents: "none",
              zIndex: 1,
              boxShadow: multiSelected
                ? "0 0 0 1px rgba(251,191,36,0.15), inset 0 0 0 1px rgba(251,191,36,0.08)"
                : "0 0 0 1px rgba(139,92,246,0.15), inset 0 0 0 1px rgba(139,92,246,0.08)",
            }}
          />

          {/* コーナーリサイズハンドル（小さい円） */}
          {(["nw", "ne", "sw", "se"] as FloorTextCornerHandle[]).map((h) => (
            <div
              key={h}
              role="presentation"
              data-floor-text-resize-handle={h}
              onPointerDown={(ev) =>
                beginFloorTextResize(ev, h, ev.currentTarget.parentElement as HTMLDivElement)
              }
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#fff",
                border: "1.5px solid rgba(139,92,246,0.9)",
                zIndex: 3,
                pointerEvents: "auto",
                cursor: handleCursor(h),
                boxSizing: "border-box",
                ...(h === "nw" ? { left: -4, top: -4 }
                  : h === "ne" ? { right: -4, top: -4 }
                  : h === "sw" ? { left: -4, bottom: -4 }
                  : { right: -4, bottom: -4 }),
              }}
            />
          ))}

          {/* 回転ハンドル（上部中央） */}
          {onUpdateTextRotation ? (
            <div
              role="presentation"
              data-floor-text-rotate-handle
              title="ドラッグで回転（Shiftで15度スナップ）"
              onPointerDown={beginRotateDrag}
              style={{
                position: "absolute",
                top: -22,
                left: "50%",
                transform: "translateX(-50%)",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "rgba(139,92,246,0.9)",
                border: "1.5px solid #fff",
                zIndex: 3,
                pointerEvents: "auto",
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              {/* 回転アイコン（↻） */}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              </svg>
            </div>
          ) : null}

          {/* ハンドルと枠をつなぐ縦線（回転ハンドル表示時） */}
          {onUpdateTextRotation ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -17,
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
                height: 12,
                background: "rgba(139,92,246,0.6)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

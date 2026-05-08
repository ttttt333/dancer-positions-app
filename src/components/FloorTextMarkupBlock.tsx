import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import type { StageFloorTextMarkup } from "../types/choreography";
import {
  clamp,
  floorTextColorHex,
  floorTextFontCss,
  floorTextMarkupScale,
  FLOOR_TEXT_FONT_OPTIONS,
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
  onUpdateTextColor,
  onUpdateTextFontFamily,
}: FloorTextMarkupBlockProps) {
  const fs = Math.max(8, Math.min(56, m.fontSizePx ?? 18));
  const fw = Math.round(clamp(m.fontWeight ?? 600, 300, 900) / 50) * 50;
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
  const editingInlineHere = floorTextInlineRectId === m.id;
  const showChrome =
    selected &&
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
    if (handle === "se") {
      ax = rect.left;
      ay = rect.top;
    } else if (handle === "nw") {
      ax = rect.right;
      ay = rect.bottom;
    } else if (handle === "ne") {
      ax = rect.left;
      ay = rect.bottom;
    } else {
      ax = rect.right;
      ay = rect.top;
    }
    const d0 = Math.max(14, Math.hypot(ev.clientX - ax, ev.clientY - ay));
    floorTextResizeDragRef.current = {
      id: m.id,
      anchorX: ax,
      anchorY: ay,
      startDist: d0,
      startScale: floorTextMarkupScale(m),
      pointerId: ev.pointerId,
    };
    try {
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    } catch {
      /* noop */
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
          ? "編集画面（タイムラインなど含む）上のテキスト。タップで選択、ダブルクリックで編集、長くドラッグで移動。右クリックで削除"
          : textMoveGrab
            ? "タップで選択（枠と色・フォント）。ダブルクリックでその場に編集。長くドラッグで移動。右クリックで削除"
            : floorMarkupTool === "text"
              ? "タップで選択。ダブルクリックでその場に編集。右クリックで削除"
              : floorMarkupTool === "erase"
                ? "タップで削除"
                : undefined
      }
      onContextMenu={(e) => {
        if (
          viewMode === "view" ||
          !setPiecesEditable ||
          playbackOrPreview ||
          previewDancers ||
          !textHit
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onContextMenuFloorText(m.id, e.clientX, e.clientY);
      }}
      onDoubleClick={(e) => {
        if (
          viewMode === "view" ||
          !setPiecesEditable ||
          playbackOrPreview ||
          previewDancers ||
          !textHit ||
          floorMarkupTool === "erase"
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onDoubleClickInlineEdit(m, r, draftFromMarkup());
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-floor-text-resize-handle]")) {
          return;
        }
        if (floorMarkupTool === "erase" && setPiecesEditable) {
          e.preventDefault();
          e.stopPropagation();
          onRemoveFloorMarkup(m.id);
          return;
        }
        if (floorMarkupTool === "text" && setPiecesEditable) {
          e.preventDefault();
          e.stopPropagation();
          onSelectTextMarkupTool(m.id, draftFromMarkup());
          return;
        }
        if (textMoveGrab) {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
        transform: `translate(-50%, -100%) scale(${sc})`,
        transformOrigin: "50% 100%",
        maxWidth: coordLayer === "screen" ? "min(42vw, 520px)" : "42%",
        padding: "2px 6px",
        borderRadius: "6px",
        fontSize: fs,
        lineHeight: 1.25,
        fontWeight: fw,
        fontFamily: fontCss,
        color: m.color ?? "#fef3c7",
        textShadow: "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        outline:
          !editingInlineHere &&
          floorMarkupTool === "text" &&
          floorTextEditId === m.id
            ? "2px solid rgba(129, 140, 248, 0.95)"
            : undefined,
        outlineOffset: 2,
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
      {showChrome ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -6,
              border: "2px solid rgba(129, 140, 248, 0.95)",
              borderRadius: 6,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          {(["nw", "ne", "sw", "se"] as FloorTextCornerHandle[]).map((h) => (
            <div
              key={h}
              role="presentation"
              data-floor-text-resize-handle={h}
              onPointerDown={(ev) =>
                beginFloorTextResize(
                  ev,
                  h,
                  ev.currentTarget.parentElement as HTMLDivElement
                )
              }
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#a5b4fc",
                border: "1px solid #0f172a",
                zIndex: 3,
                pointerEvents: "auto",
                cursor: handleCursor(h),
                boxSizing: "border-box",
                ...(h === "nw"
                  ? { left: -5, top: -5 }
                  : h === "ne"
                    ? { right: -5, top: -5 }
                    : h === "sw"
                      ? { left: -5, bottom: -5 }
                      : { right: -5, bottom: -5 }),
              }}
            />
          ))}
        </>
      ) : null}
      {showChrome && floorMarkupTool === null ? (
        <div
          role="toolbar"
          aria-label={
            coordLayer === "screen" ? "画面テキストの色とフォント" : "床テキストの色とフォント"
          }
          onPointerDown={(ev) => ev.stopPropagation()}
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            transform: "translate(-50%, 8px)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px",
            borderRadius: 8,
            border: "1px solid #475569",
            background: "rgba(15, 23, 42, 0.96)",
            zIndex: 4,
            pointerEvents: "auto",
            minWidth: 120,
          }}
        >
          <input
            type="color"
            aria-label="文字色"
            title="文字色"
            value={colorHex}
            onChange={(ev) => {
              onUpdateTextColor(m.id, ev.target.value);
            }}
            style={{
              width: 28,
              height: 22,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          />
          <select
            aria-label="フォント"
            title="フォント"
            value={
              FLOOR_TEXT_FONT_OPTIONS.some((o) => o.value === fontCss)
                ? fontCss
                : FLOOR_TEXT_FONT_OPTIONS[0]!.value
            }
            onChange={(ev) => {
              onUpdateTextFontFamily(m.id, ev.target.value);
            }}
            style={{
              fontSize: 10,
              maxWidth: 118,
              borderRadius: 4,
              border: "1px solid #334155",
              background: "#020617",
              color: "#e2e8f0",
            }}
          >
            {FLOOR_TEXT_FONT_OPTIONS.map((o) => (
              <option key={o.id} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

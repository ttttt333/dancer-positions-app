import type { PointerEvent as ReactPointerEvent } from "react";
import type { FloorTextPlaceSession } from "../types/choreography";
import {
  clamp,
  floorTextColorHex,
  FLOOR_TEXT_DEFAULT_FONT,
} from "../lib/stageBoardModelHelpers";

export type FloorTextPlacePreviewProps = {
  session: FloorTextPlaceSession;
  /** `title` 属性（画面ポータル用とメイン床用で文言を分ける） */
  dragTitle: string;
  /** ラッパーの `maxWidth`（例: `min(42vw, 520px)` / `42%`） */
  maxWidth: string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

/** ヘッダから床へ置く前のテキスト位置プレビュー（ドラッグで座標調整） */
export function FloorTextPlacePreview({
  session,
  dragTitle,
  maxWidth,
  onPointerDown,
}: FloorTextPlacePreviewProps) {
  const scale = (() => {
    const s = session.scale;
    if (typeof s === "number" && Number.isFinite(s) && s > 0) {
      return Math.min(8, Math.max(0.2, s));
    }
    return 1;
  })();

  return (
    <div
      data-floor-text-place-preview
      role="presentation"
      title={dragTitle}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${session.xPct}%`,
        top: `${session.yPct}%`,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: "50% 100%",
        maxWidth,
        padding: "4px 8px",
        borderRadius: "8px",
        fontSize: Math.max(8, Math.min(56, Math.round(session.fontSizePx))),
        lineHeight: 1.25,
        fontWeight:
          Math.round(clamp(session.fontWeight, 300, 900) / 50) * 50,
        fontFamily:
          (session.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT,
        color: floorTextColorHex({
          kind: "text",
          id: "_preview",
          xPct: 0,
          yPct: 0,
          text: "",
          color: session.color,
        }),
        textShadow: "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        outline: "2px dashed rgba(56, 189, 248, 0.95)",
        outlineOffset: 2,
        pointerEvents: "auto",
        cursor: "grab",
        zIndex: 8,
        background: "rgba(15, 23, 42, 0.35)",
      }}
    >
      {session.body.trim() ? session.body : "（テキストを入力）"}
    </div>
  );
}

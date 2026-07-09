import { clamp, floorTextDraftColorHex, FLOOR_TEXT_DEFAULT_FONT } from "../lib/stageBoardModelHelpers";
import type { FloorTextDraftShape } from "./FloorTextDraftEditorForm";

export type FloorTextDraftGhostPreviewProps = {
  draft: FloorTextDraftShape;
  /** ステージ内の位置 (%) — マウス追跡しない場合は中央 50,50 を渡す */
  xPct: number;
  yPct: number;
  /** ステージの表示スケール（markupScale相当）— なければ 1 */
  markupScale?: number;
};

/**
 * `floorMarkupTool==="text"` で入力中のテキストをステージ上にゴーストプレビューとして表示。
 * ポインターイベントは無効（クリック配置はステージの通常フローに任せる）。
 */
export function FloorTextDraftGhostPreview({
  draft,
  xPct,
  yPct,
  markupScale = 1,
}: FloorTextDraftGhostPreviewProps) {
  const body = draft.body.trim();
  if (!body) return null;
  const label = body;
  const fs = Math.round(clamp(draft.fontSizePx ?? 18, 8, 56) * markupScale);
  const fw = Math.round(clamp(draft.fontWeight ?? 600, 300, 900) / 50) * 50;
  const ff = (draft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
  const col = floorTextDraftColorHex(draft.color);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9,
        fontSize: Math.max(8, fs),
        fontWeight: fw,
        fontFamily: ff,
        color: body ? col : "rgba(148,163,184,0.75)",
        textShadow: body
          ? "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)"
          : "none",
        whiteSpace: "pre",
        wordBreak: "normal",
        maxWidth: "none",
        textAlign: "center",
        outline: `2px dashed ${body ? "rgba(56,189,248,0.85)" : "rgba(100,116,139,0.55)"}`,
        outlineOffset: 4,
        padding: "4px 8px",
        borderRadius: 6,
        background: body ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.20)",
        userSelect: "none",
        lineHeight: 1.3,
      }}
    >
      {label}
    </div>
  );
}

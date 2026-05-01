import type { Dispatch, SetStateAction } from "react";
import type { Formation } from "../types/choreography";
import {
  clamp,
  floorTextDraftColorHex,
  FLOOR_TEXT_FONT_OPTIONS,
} from "../lib/stageBoardModelHelpers";

export type FloorTextDraftShape = {
  body: string;
  fontSizePx: number;
  fontWeight: number;
  color: string;
  fontFamily: string;
};

export type FloorTextDraftEditorFormProps = {
  draft: FloorTextDraftShape;
  setDraft: Dispatch<SetStateAction<FloorTextDraftShape>>;
  floorTextEditId: string | null;
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
};

/** 床テキストツール用: 本文・サイズ・太さ・色・フォントと操作ヒント */
export function FloorTextDraftEditorForm({
  draft,
  setDraft,
  floorTextEditId,
  updateActiveFormation,
}: FloorTextDraftEditorFormProps) {
  return (
    <>
      <textarea
        value={draft.body}
        onChange={(e) => {
          const body = e.target.value;
          setDraft((d) => ({ ...d, body }));
          if (floorTextEditId) {
            updateActiveFormation((f) => ({
              ...f,
              floorMarkup: (f.floorMarkup ?? []).map((m) =>
                m.id === floorTextEditId && m.kind === "text"
                  ? { ...m, text: body.slice(0, 400) }
                  : m
              ),
            }));
          }
        }}
        rows={2}
        placeholder="ステージに表示する文言…"
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 44,
          boxSizing: "border-box",
          borderRadius: 6,
          border: "1px solid #475569",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          padding: "6px 8px",
          fontFamily: "system-ui, sans-serif",
        }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 16px",
          fontSize: "11px",
          color: "#cbd5e1",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          サイズ {draft.fontSizePx}px
          <input
            type="range"
            min={8}
            max={56}
            value={draft.fontSizePx}
            onChange={(e) => {
              const fontSizePx = Number(e.target.value);
              setDraft((d) => ({ ...d, fontSizePx }));
              if (floorTextEditId) {
                updateActiveFormation((f) => ({
                  ...f,
                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                    m.id === floorTextEditId && m.kind === "text"
                      ? {
                          ...m,
                          fontSizePx: Math.round(clamp(fontSizePx, 8, 56)),
                        }
                      : m
                  ),
                }));
              }
            }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          太さ {draft.fontWeight}
          <input
            type="range"
            min={300}
            max={900}
            step={50}
            value={draft.fontWeight}
            onChange={(e) => {
              const fontWeight = Number(e.target.value);
              setDraft((d) => ({ ...d, fontWeight }));
              if (floorTextEditId) {
                const fw =
                  Math.round(clamp(fontWeight, 300, 900) / 50) * 50;
                updateActiveFormation((f) => ({
                  ...f,
                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                    m.id === floorTextEditId && m.kind === "text"
                      ? { ...m, fontWeight: fw }
                      : m
                  ),
                }));
              }
            }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>色</span>
          <input
            type="color"
            aria-label="文字色"
            title="文字色"
            value={floorTextDraftColorHex(draft.color)}
            onChange={(ev) => {
              const v = ev.target.value;
              setDraft((d) => ({ ...d, color: v }));
              if (floorTextEditId) {
                updateActiveFormation((f) => ({
                  ...f,
                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                    m.id === floorTextEditId && m.kind === "text"
                      ? { ...m, color: v }
                      : m
                  ),
                }));
              }
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
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>フォント</span>
          <select
            aria-label="フォント"
            title="フォント"
            value={
              FLOOR_TEXT_FONT_OPTIONS.some((o) => o.value === draft.fontFamily)
                ? draft.fontFamily
                : FLOOR_TEXT_FONT_OPTIONS[0]!.value
            }
            onChange={(ev) => {
              const v = ev.target.value;
              setDraft((d) => ({ ...d, fontFamily: v }));
              if (floorTextEditId) {
                updateActiveFormation((f) => ({
                  ...f,
                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                    m.id === floorTextEditId && m.kind === "text"
                      ? { ...m, fontFamily: v }
                      : m
                  ),
                }));
              }
            }}
            style={{
              fontSize: 11,
              maxWidth: 160,
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
        </label>
      </div>
      <div
        style={{
          fontSize: "10px",
          lineHeight: 1.4,
          color: "#64748b",
        }}
      >
        {floorTextEditId
          ? "空の床をクリックで位置を移動。サイズ・太さ・色・フォントはここまたはステージ上のツールバーで変更できます。"
          : "本文を入力してから床をクリックで配置。既存の床テキストをクリックすると編集できます。"}
      </div>
    </>
  );
}

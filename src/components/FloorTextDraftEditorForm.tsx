import type { Dispatch, SetStateAction } from "react";
import type { Formation, StageFloorMarkup } from "../types/choreography";
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
  bgColor: string; // "" = 背景なし、それ以外は背景色
  /** "formation" = このキュー固有 / "global" = 全編共通 */
  scope: "formation" | "global";
};

export type FloorTextDraftEditorFormProps = {
  draft: FloorTextDraftShape;
  setDraft: Dispatch<SetStateAction<FloorTextDraftShape>>;
  floorTextEditId: string | null;
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  /** テンプレ文字をクリックで即座にステージ配置する */
  onAddTemplateText?: (text: string) => void;
  /**
   * 編集中テキストが globalFloorMarkup 側かどうか（true = 全編共通）。
   * 未指定は false（フォーメーション固有）。
   */
  floorTextEditIsGlobal?: boolean;
  /** globalFloorMarkup の更新コールバック */
  onUpdateGlobalMarkup?: (updater: (prev: StageFloorMarkup[]) => StageFloorMarkup[]) => void;
};

/** テンプレ一発配置ボタン用定義 */
const TEXT_TEMPLATES = [
  { label: "上手", text: "上手" },
  { label: "下手", text: "下手" },
  { label: "中央", text: "中央" },
  { label: "奥", text: "奥" },
  { label: "前", text: "前" },
  { label: "SR", text: "SR" },
  { label: "SL", text: "SL" },
  { label: "C", text: "C" },
];

const BG_PRESETS = [
  { label: "なし", value: "" },
  { label: "黒", value: "rgba(0,0,0,0.65)" },
  { label: "紺", value: "rgba(15,23,42,0.80)" },
  { label: "紫", value: "rgba(88,28,135,0.70)" },
  { label: "白", value: "rgba(255,255,255,0.15)" },
];

/** 床テキストツール用: 本文・サイズ・太さ・色・背景・フォント・テンプレ */
export function FloorTextDraftEditorForm({
  draft,
  setDraft,
  floorTextEditId,
  updateActiveFormation,
  onAddTemplateText,
  floorTextEditIsGlobal = false,
  onUpdateGlobalMarkup,
}: FloorTextDraftEditorFormProps) {
  const updateMarkup = (patch: Record<string, unknown>) => {
    if (!floorTextEditId) return;
    if (floorTextEditIsGlobal && onUpdateGlobalMarkup) {
      onUpdateGlobalMarkup((prev) =>
        prev.map((m) =>
          m.id === floorTextEditId && m.kind === "text" ? { ...m, ...patch } : m
        )
      );
    } else {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((m) =>
          m.id === floorTextEditId && m.kind === "text"
            ? { ...m, ...patch }
            : m
        ),
      }));
    }
  };

  return (
    <>
      {/* ── スコープ選択（全編共通 / このキュー固有） ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          marginBottom: 8,
        }}
      >
        {(["formation", "global"] as const).map((s) => {
          const active = draft.scope === s;
          const label = s === "formation" ? "このキュー固有" : "全編共通";
          const desc = s === "formation" ? "選択中シーンにのみ表示" : "全シーンで常時表示";
          return (
            <button
              key={s}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, scope: s }))}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                padding: "5px 7px",
                borderRadius: 7,
                border: active ? "2px solid #d4af37" : "1px solid #334155",
                background: active ? "rgba(212,175,55,0.13)" : "#0a0f1e",
                color: active ? "#f5e199" : "#94a3b8",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{label}</span>
              <span style={{ fontSize: 9.5, color: active ? "#d4af37" : "#64748b", lineHeight: 1.2 }}>{desc}</span>
            </button>
          );
        })}
      </div>

      {/* ── テンプレ一発配置 ── */}
      {onAddTemplateText && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>よく使うワード</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {TEXT_TEMPLATES.map((t) => (
              <button
                key={t.text}
                type="button"
                title={`「${t.text}」をステージ中央に追加`}
                onClick={() => onAddTemplateText(t.text)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid #3a3000",
                  background: "#1a1400",
                  color: "#d4af37",
                  cursor: "pointer",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.18)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1a1400"; }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── テキスト入力 ── */}
      <textarea
        value={draft.body}
        onChange={(e) => {
          const body = e.target.value;
          setDraft((d) => ({ ...d, body }));
          updateMarkup({ text: body.slice(0, 400) });
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

      {/* ── スタイル調整 ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px 14px",
          fontSize: "11px",
          color: "#cbd5e1",
        }}
      >
        {/* サイズ */}
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          サイズ {draft.fontSizePx}px
          <input
            type="range" min={8} max={72} value={draft.fontSizePx}
            onChange={(e) => {
              const fontSizePx = Number(e.target.value);
              setDraft((d) => ({ ...d, fontSizePx }));
              updateMarkup({ fontSizePx: Math.round(clamp(fontSizePx, 8, 72)) });
            }}
          />
        </label>

        {/* 太さ */}
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          太さ
          <input
            type="range" min={300} max={900} step={100} value={draft.fontWeight}
            onChange={(e) => {
              const fontWeight = Number(e.target.value);
              setDraft((d) => ({ ...d, fontWeight }));
              const fw = Math.round(clamp(fontWeight, 300, 900) / 100) * 100;
              updateMarkup({ fontWeight: fw });
            }}
          />
        </label>

        {/* 文字色 */}
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>文字色</span>
          <input
            type="color"
            aria-label="文字色"
            value={floorTextDraftColorHex(draft.color)}
            onChange={(ev) => {
              const v = ev.target.value;
              setDraft((d) => ({ ...d, color: v }));
              updateMarkup({ color: v });
            }}
            style={{ width: 28, height: 22, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
          />
        </label>

        {/* フォント */}
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>フォント</span>
          <select
            value={
              FLOOR_TEXT_FONT_OPTIONS.some((o) => o.value === draft.fontFamily)
                ? draft.fontFamily
                : FLOOR_TEXT_FONT_OPTIONS[0]!.value
            }
            onChange={(ev) => {
              const v = ev.target.value;
              setDraft((d) => ({ ...d, fontFamily: v }));
              updateMarkup({ fontFamily: v });
            }}
            style={{ fontSize: 11, maxWidth: 130, borderRadius: 4, border: "1px solid #334155", background: "#020617", color: "#e2e8f0" }}
          >
            {FLOOR_TEXT_FONT_OPTIONS.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── 背景色 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#cbd5e1", flexWrap: "wrap" }}>
        <span style={{ flexShrink: 0 }}>背景</span>
        {BG_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            title={p.label}
            onClick={() => {
              setDraft((d) => ({ ...d, bgColor: p.value }));
              updateMarkup({ bgColor: p.value });
            }}
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 5,
              border: draft.bgColor === p.value
                ? "1.5px solid #c084fc"
                : "1px solid #334155",
              background: p.value || "#0f172a",
              color: p.value === "rgba(255,255,255,0.15)" ? "#0f172a" : "#e2e8f0",
              cursor: "pointer",
              fontWeight: draft.bgColor === p.value ? 700 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
        {/* カスタム背景色 */}
        <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span>カスタム</span>
          <input
            type="color"
            aria-label="背景色カスタム"
            value={
              draft.bgColor && !BG_PRESETS.slice(1).some(p => p.value === draft.bgColor)
                ? draft.bgColor.startsWith("#") ? draft.bgColor : "#000000"
                : "#000000"
            }
            onChange={(ev) => {
              const v = ev.target.value;
              setDraft((d) => ({ ...d, bgColor: v }));
              updateMarkup({ bgColor: v });
            }}
            style={{ width: 24, height: 20, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
          />
        </label>
      </div>

      <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#64748b" }}>
        {floorTextEditId
          ? `ドラッグで移動・ダブルクリックで編集。Delete/Backspaceで削除。${draft.scope === "global" ? "【全編共通】" : "【このキュー固有】"}`
          : `テキストを入力してテンプレをクリックで配置。スコープで表示範囲を選択。${draft.scope === "global" ? "【全編共通】" : "【このキュー固有】"}`}
      </div>
    </>
  );
}

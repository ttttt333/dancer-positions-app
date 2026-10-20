import { createPortal } from "react-dom";
import type { LightingPresetItem } from "../lib/lightingPresets";
import { shell } from "../theme/choreoShell";

export type LightingPresetPickModalProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  presets: readonly LightingPresetItem[];
  onClose: () => void;
  onPick: (preset: LightingPresetItem) => void;
};

/**
 * 照明プリセットを番号入力ではなくクリックで選ぶモーダル。
 */
export function LightingPresetPickModal({
  open,
  title = "照明プリセットを選択",
  subtitle = "クリックしたプリセットを適用します（対象の照明は置き換わります）",
  presets,
  onClose,
  onPick,
}: LightingPresetPickModalProps) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3200,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        style={{
          width: "min(380px, calc(100vw - 24px))",
          maxHeight: "min(78vh, 520px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: `1px solid ${shell.border}`,
          background: shell.surface,
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 16px 8px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: "#f8fafc",
            }}
          >
            {title}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#94a3b8",
            }}
          >
            {subtitle}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {presets.length === 0 ? (
            <p style={{ margin: "12px 6px", fontSize: 12, color: "#64748b" }}>
              保存済みプリセットがありません。
            </p>
          ) : (
            presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPick(preset)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0 }}>
                  {preset.name}
                </span>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#94a3b8",
                  }}
                >
                  {preset.lights.length}灯
                </span>
              </button>
            ))
          )}
        </div>
        <div
          style={{
            padding: "10px 12px 12px",
            borderTop: "1px solid #1e293b",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

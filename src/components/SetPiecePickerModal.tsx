import { useCallback, useEffect, useId, useState } from "react";
import type { SetPieceKind } from "../types/choreography";
import { btnSecondary } from "./StageBoard";

export type SetPiecePickerSubmit = {
  kind: SetPieceKind;
  fillColor: string;
};

const PRESET_COLORS = [
  "#64748b",
  "#475569",
  "#334155",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#f8fafc",
] as const;

const DEFAULT_COLOR = "#64748b";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: SetPiecePickerSubmit) => void;
  disabled?: boolean;
};

function ShapePreview({
  kind,
  fill,
  size = 44,
}: {
  kind: SetPieceKind;
  fill: string;
  size?: number;
}) {
  const s = { width: size, height: size, background: fill } as const;
  if (kind === "ellipse") {
    return (
      <div
        style={{
          ...s,
          borderRadius: "50%",
          border: "1px solid rgba(15,23,42,0.45)",
        }}
      />
    );
  }
  if (kind === "triangle") {
    return (
      <div
        style={{
          width: size,
          height: size,
          clipPath: "polygon(50% 8%, 8% 92%, 92% 92%)",
          WebkitClipPath: "polygon(50% 8%, 8% 92%, 92% 92%)",
          background: fill,
          border: "1px solid rgba(15,23,42,0.25)",
          boxSizing: "border-box",
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...s,
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.45)",
      }}
    />
  );
}

/**
 * 大道具追加時: 図形種類と塗り色を選んでから配置するモーダル。
 */
export function SetPiecePickerModal({
  open,
  onClose,
  onConfirm,
  disabled = false,
}: Props) {
  const titleId = useId();
  const [kind, setKind] = useState<SetPieceKind>("rect");
  const [fillColor, setFillColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    if (open) {
      setKind("rect");
      setFillColor(DEFAULT_COLOR);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = useCallback(() => {
    if (disabled) return;
    onConfirm({ kind, fillColor: fillColor.trim().toLowerCase() });
  }, [disabled, kind, fillColor, onConfirm]);

  if (!open) return null;

  const shapeChoices: { k: SetPieceKind; label: string }[] = [
    { k: "rect", label: "矩形" },
    { k: "ellipse", label: "円・楕円" },
    { k: "triangle", label: "三角" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
          padding: "16px 18px 18px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <h3
            id={titleId}
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            大道具を追加
          </h3>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            style={{
              ...btnSecondary,
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px 12px",
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
          図形と色を選んでからステージに配置します。楕円は配置後に枠をドラッグして伸ばせます。
        </p>

        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#64748b",
              marginBottom: "8px",
            }}
          >
            図形
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {shapeChoices.map(({ k, label }) => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => setKind(k)}
                  style={{
                    ...btnSecondary,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 8px",
                    borderColor: on ? "#6366f1" : undefined,
                    color: on ? "#c7d2fe" : undefined,
                    background: on ? "rgba(99, 102, 241, 0.12)" : undefined,
                  }}
                >
                  <ShapePreview kind={k} fill={fillColor} size={40} />
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#64748b",
              marginBottom: "8px",
            }}
          >
            色
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                title={c}
                onClick={() => setFillColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border:
                    fillColor.toLowerCase() === c
                      ? "2px solid #fbbf24"
                      : "1px solid #1e293b",
                  background: c,
                  padding: 0,
                  cursor: disabled ? "not-allowed" : "pointer",
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12px",
              color: "#cbd5e1",
            }}
          >
            <span style={{ flex: "0 0 auto" }}>カスタム</span>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(fillColor) ? fillColor : DEFAULT_COLOR}
              disabled={disabled}
              onChange={(e) => setFillColor(e.target.value.toLowerCase())}
              style={{
                width: 48,
                height: 32,
                padding: 0,
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#020617",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            />
            <code style={{ fontSize: "11px", color: "#94a3b8" }}>{fillColor}</code>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            disabled={disabled}
            onClick={onClose}
            style={{ ...btnSecondary, padding: "8px 14px", fontSize: "13px" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={submit}
            style={{
              ...btnSecondary,
              padding: "8px 16px",
              fontSize: "13px",
              borderColor: "#6366f1",
              color: "#e0e7ff",
              background: "rgba(99, 102, 241, 0.35)",
            }}
          >
            ステージに追加
          </button>
        </div>
      </div>
    </div>
  );
}

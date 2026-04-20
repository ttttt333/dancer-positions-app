import { useEffect, useState, type CSSProperties } from "react";
import type { DancerSpot } from "../types/choreography";

const DANCER_PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  "#f8fafc",
] as const;

const LABEL_MAX = 8;
const NOTE_MAX = 2000;

export type DancerQuickEditApply = {
  label: string;
  colorIndex: number;
  note: string | undefined;
  heightCm: number | undefined;
};

type Props = {
  open: boolean;
  dancer: DancerSpot | null;
  viewMode: "edit" | "view";
  onClose: () => void;
  onApply: (patch: DancerQuickEditApply) => void;
};

/**
 * 立ち位置の丸をダブルクリックしたときの小さな編集窓。
 * 名前・色・身長・メモ（舞台非表示）。OK で確定。
 */
export function DancerQuickEditDialog({
  open,
  dancer,
  viewMode,
  onClose,
  onApply,
}: Props) {
  const [label, setLabel] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [note, setNote] = useState("");
  const [heightStr, setHeightStr] = useState("");

  useEffect(() => {
    if (!open || !dancer) return;
    setLabel(
      (dancer.label?.trim() ? dancer.label : "?").slice(0, LABEL_MAX)
    );
    setColorIndex(dancer.colorIndex % 9);
    setNote(dancer.note ?? "");
    setHeightStr(
      typeof dancer.heightCm === "number" && Number.isFinite(dancer.heightCm)
        ? String(dancer.heightCm)
        : ""
    );
    /** open / 対象 id のみ。親の再レンダーで dancer 参照が変わっても入力中の下書きを潰さない */
  }, [open, dancer?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !dancer) return null;

  const disabled = viewMode === "view";

  const commit = () => {
    const labelTrim = label.trim().slice(0, LABEL_MAX) || "?";
    const noteTrim = note.trim().slice(0, NOTE_MAX);
    const noteOut = noteTrim ? noteTrim : undefined;
    let heightCm: number | undefined;
    const h = parseFloat(heightStr.replace(/,/g, "."));
    if (heightStr.trim() !== "" && Number.isFinite(h) && h > 0 && h < 300) {
      heightCm = Math.round(h * 10) / 10;
    } else {
      heightCm = undefined;
    }
    onApply({
      label: labelTrim,
      colorIndex: colorIndex % 9,
      note: noteOut,
      heightCm,
    });
    onClose();
  };

  const backdrop: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(2, 6, 23, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  };

  const card: CSSProperties = {
    width: "min(320px, 100%)",
    maxHeight: "min(90vh, 520px)",
    overflow: "auto",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "12px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
    padding: "14px 16px",
    color: "#e2e8f0",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#f1f5f9",
    fontSize: "14px",
    outline: "none",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dancer-quick-edit-title"
      style={backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2
          id="dancer-quick-edit-title"
          style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700 }}
        >
          立ち位置の設定
        </h2>

        <div style={{ marginBottom: "12px" }}>
          <span style={labelStyle}>表示名（舞台）</span>
          <input
            type="text"
            value={label}
            disabled={disabled}
            maxLength={LABEL_MAX}
            onChange={(e) =>
              setLabel(e.target.value.slice(0, LABEL_MAX))
            }
            style={inputStyle}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <span style={labelStyle}>色</span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "6px",
            }}
          >
            {DANCER_PALETTE.map((hex, i) => (
              <button
                key={hex}
                type="button"
                disabled={disabled}
                title={`色 ${i + 1}`}
                onClick={() => setColorIndex(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border:
                    colorIndex === i
                      ? "3px solid #a5b4fc"
                      : "2px solid rgba(255,255,255,0.25)",
                  background: hex,
                  cursor: disabled ? "not-allowed" : "pointer",
                  padding: 0,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <span style={labelStyle}>身長（cm・舞台には出しません）</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="例: 162"
            value={heightStr}
            disabled={disabled}
            onChange={(e) => setHeightStr(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <span style={labelStyle}>メモ・備考（舞台には表示しません）</span>
          <textarea
            value={note}
            disabled={disabled}
            placeholder="靴・注意事項など"
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: "72px",
              fontSize: "12px",
              lineHeight: 1.45,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={commit}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #14532d",
              background: "#166534",
              color: "#dcfce7",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

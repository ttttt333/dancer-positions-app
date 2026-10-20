import type { CSSProperties } from "react";
import {
  DANCER_FIGURE_3D_CATALOG,
  type DancerFigure3dId,
} from "../lib/dancerFigure3d";

type Props = {
  value: DancerFigure3dId;
  disabled?: boolean;
  onChange: (next: DancerFigure3dId) => void;
  compact?: boolean;
};

const chipBase: CSSProperties = {
  borderRadius: 10,
  padding: "8px 6px",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  cursor: "pointer",
  background: "#020617",
  boxSizing: "border-box",
  minHeight: 52,
};

/**
 * 3D フィギュア（人型・動物）選択グリッド。
 */
export function DancerFigure3dPicker({
  value,
  disabled,
  onChange,
  compact,
}: Props) {
  const gap = compact ? 6 : 8;
  return (
    <div
      role="listbox"
      aria-label="3Dの見た目"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap,
      }}
    >
      {DANCER_FIGURE_3D_CATALOG.map((fig) => {
        const on = value === fig.id;
        return (
          <button
            key={fig.id}
            type="button"
            role="option"
            aria-selected={on}
            disabled={disabled}
            title={fig.labelJa}
            onClick={() => onChange(fig.id)}
            style={{
              ...chipBase,
              width: "100%",
              border: on
                ? "2px solid rgba(165,180,252,0.95)"
                : "1px solid #334155",
              color: on ? "#e0e7ff" : "#94a3b8",
              fontSize: compact ? 10 : 11,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              background: on ? "rgba(99,102,241,0.18)" : "#020617",
            }}
          >
            <span style={{ fontSize: compact ? 18 : 22, lineHeight: 1 }}>
              {fig.emoji}
            </span>
            <span>{fig.labelJa}</span>
          </button>
        );
      })}
    </div>
  );
}

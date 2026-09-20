import type { CSSProperties } from "react";
import type { DancerFigure3dApplyScope } from "../lib/applyDancerFigure3d";

type Props = {
  value: DancerFigure3dApplyScope;
  onChange: (next: DancerFigure3dApplyScope) => void;
  disabled?: boolean;
};

const btnBase: CSSProperties = {
  flex: 1,
  padding: "7px 8px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  boxSizing: "border-box",
};

/**
 * 3D 見た目の適用範囲（このキューだけ / すべてのキュー）。
 */
export function DancerFigure3dApplyScopeToggle({
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <div
      role="group"
      aria-label="3D見た目の適用範囲"
      style={{ display: "flex", gap: 6, marginBottom: 8 }}
    >
      {(
        [
          { id: "cue" as const, label: "このキューだけ" },
          { id: "all" as const, label: "すべてのキュー" },
        ] as const
      ).map((opt) => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(opt.id)}
            style={{
              ...btnBase,
              border: on
                ? "1px solid rgba(251,191,36,0.9)"
                : "1px solid #334155",
              background: on ? "rgba(251,191,36,0.16)" : "#020617",
              color: on ? "#fde68a" : "#94a3b8",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

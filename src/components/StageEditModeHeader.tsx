import type { CSSProperties } from "react";
import type { StageEditMode } from "../lib/stageEditMode";

const LEVELS = [
  { id: "dancer" as const, label: "DANCER" },
  { id: "group" as const, label: "GROUP" },
  { id: "formation" as const, label: "FORMATION" },
];

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  flexShrink: 0,
  width: "100%",
  padding: "4px 8px 8px",
  userSelect: "none",
};

const item: CSSProperties = {
  padding: "4px 10px 6px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  lineHeight: 1,
  borderBottom: "2px solid transparent",
  color: "#64748b",
};

const sep: CSSProperties = {
  padding: "0 2px 4px",
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
  lineHeight: 1,
};

export type StageEditModeHeaderProps = {
  mode: StageEditMode;
};

/**
 * ステージ枠の外・上側。選択から自動判定した編集レベルだけ下線。
 * タップでレベルは切り替えない。
 */
export function StageEditModeHeader({ mode }: StageEditModeHeaderProps) {
  return (
    <div
      data-stage-edit-mode-header
      role="status"
      aria-label="編集レベル"
      style={row}
    >
      {LEVELS.map((level, i) => {
        const active = mode === level.id;
        return (
          <span key={level.id} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 ? <span style={sep}>｜</span> : null}
            <span
              aria-current={active ? "true" : undefined}
              style={{
                ...item,
                color: active ? "#e2e8f0" : "#64748b",
                borderBottomColor: active ? "#f8fafc" : "transparent",
              }}
            >
              {level.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

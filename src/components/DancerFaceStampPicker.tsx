import type { CSSProperties } from "react";
import {
  DANCER_FACE_STAMP_CATALOG,
  type DancerFaceStampId,
} from "../lib/dancerFaceStamp";
import { DancerFaceStampGlyph } from "./DancerFaceStampGlyph";

type Props = {
  value: DancerFaceStampId | null;
  disabled?: boolean;
  onChange: (next: DancerFaceStampId | null) => void;
  /** コンパクト表示（ドック用） */
  compact?: boolean;
};

const chipBase: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  background: "#020617",
  boxSizing: "border-box",
};

/**
 * 表情スタンプ選択グリッド。「なし」でクリア。
 */
export function DancerFaceStampPicker({
  value,
  disabled,
  onChange,
  compact,
}: Props) {
  const gap = compact ? 6 : 8;
  const size = compact ? 28 : 32;

  return (
    <div
      role="listbox"
      aria-label="表情スタンプ"
      style={{
        display: "grid",
        gridTemplateColumns: compact
          ? "repeat(4, minmax(0, 1fr))"
          : "repeat(4, minmax(0, 1fr))",
        gap,
      }}
    >
      <button
        type="button"
        role="option"
        aria-selected={value == null}
        disabled={disabled}
        title="表情なし"
        onClick={() => onChange(null)}
        style={{
          ...chipBase,
          width: "100%",
          minHeight: compact ? 40 : 48,
          border:
            value == null
              ? "2px solid rgba(165,180,252,0.95)"
              : "1px solid #334155",
          color: "#94a3b8",
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        なし
      </button>
      {DANCER_FACE_STAMP_CATALOG.map((stamp) => {
        const on = value === stamp.id;
        return (
          <button
            key={stamp.id}
            type="button"
            role="option"
            aria-selected={on}
            disabled={disabled}
            title={stamp.labelJa}
            onClick={() => onChange(stamp.id)}
            style={{
              ...chipBase,
              width: "100%",
              minHeight: compact ? 40 : 48,
              flexDirection: "column",
              gap: 2,
              border: on
                ? "2px solid rgba(165,180,252,0.95)"
                : "1px solid #334155",
              background: on ? "rgba(99,102,241,0.18)" : "#020617",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <span
              style={{
                width: size + 6,
                height: size + 6,
                borderRadius: "50%",
                background: "#38bdf8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DancerFaceStampGlyph id={stamp.id} size={size} />
            </span>
            {!compact ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: on ? "#e0e7ff" : "#94a3b8",
                  lineHeight: 1.1,
                }}
              >
                {stamp.labelJa}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

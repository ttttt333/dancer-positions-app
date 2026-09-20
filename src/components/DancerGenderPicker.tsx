import type { CSSProperties } from "react";
import {
  DANCER_GENDER_FEMALE_HEX,
  DANCER_GENDER_LABEL_FEMALE,
  DANCER_GENDER_LABEL_MALE,
  DANCER_GENDER_MALE_HEX,
  dancerGenderLabelForKind,
  parseDancerGenderKind,
  type DancerGenderKind,
} from "../lib/dancerGender";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (nextLabel: string) => void;
};

const btnBase: CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

/**
 * 性別を男子／女子／なしで選ぶ。男子＝青・女子＝ピンク表示用。
 */
export function DancerGenderPicker({ value, disabled, onChange }: Props) {
  const kind = parseDancerGenderKind(value);

  const pick = (next: DancerGenderKind | null) => {
    if (disabled) return;
    onChange(next ? dancerGenderLabelForKind(next) : "");
  };

  return (
    <div
      role="group"
      aria-label="性別"
      style={{ display: "flex", gap: 8 }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={kind === "male"}
        onClick={() => pick(kind === "male" ? null : "male")}
        style={{
          ...btnBase,
          border:
            kind === "male"
              ? `2px solid ${DANCER_GENDER_MALE_HEX}`
              : "1px solid #334155",
          background:
            kind === "male" ? "rgba(59,130,246,0.28)" : "#020617",
          color: kind === "male" ? "#dbeafe" : "#94a3b8",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {DANCER_GENDER_LABEL_MALE}
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: DANCER_GENDER_MALE_HEX,
            marginLeft: 6,
            verticalAlign: "middle",
          }}
        />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={kind === "female"}
        onClick={() => pick(kind === "female" ? null : "female")}
        style={{
          ...btnBase,
          border:
            kind === "female"
              ? `2px solid ${DANCER_GENDER_FEMALE_HEX}`
              : "1px solid #334155",
          background:
            kind === "female" ? "rgba(236,72,153,0.28)" : "#020617",
          color: kind === "female" ? "#fce7f3" : "#94a3b8",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {DANCER_GENDER_LABEL_FEMALE}
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: DANCER_GENDER_FEMALE_HEX,
            marginLeft: 6,
            verticalAlign: "middle",
          }}
        />
      </button>
    </div>
  );
}

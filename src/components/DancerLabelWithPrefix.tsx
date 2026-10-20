import type { CSSProperties, ReactNode } from "react";

/** 苗字頭文字プレフィックスの相対サイズ（本体フォントに対する割合） */
export const DANCER_LABEL_PREFIX_SCALE = 0.6;

/**
 * 名下ラベル用。`labelPrefix` があるときはその部分だけ小さく少し上げて描く。
 */
export function DancerLabelWithPrefix({
  label,
  prefix,
  style,
}: {
  label: string;
  prefix?: string | null;
  style?: CSSProperties;
}): ReactNode {
  const text = label.trim() || "?";
  const p = (prefix ?? "").trim();
  if (!p || !text.startsWith(p)) {
    return text;
  }
  const rest = text.slice(p.length);
  return (
    <span style={style}>
      <span
        aria-hidden
        style={{
          fontSize: `${DANCER_LABEL_PREFIX_SCALE * 100}%`,
          fontWeight: 700,
          position: "relative",
          top: "-0.28em",
          marginRight: "0.04em",
          verticalAlign: "baseline",
        }}
      >
        {p}
      </span>
      {rest}
    </span>
  );
}

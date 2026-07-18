import type { CSSProperties } from "react";
import type { ViewerAudiencePerspective } from "../lib/viewerAudiencePerspective";
import { btnSecondary } from "./stageButtonStyles";

type Props = {
  perspective: ViewerAudiencePerspective;
  onChange: (next: ViewerAudiencePerspective) => void;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** 編集画面: 客席側／舞台裏側から見る向きをワンタップで反転する */
export function EditorPerspectiveToggle({
  perspective,
  onChange,
  compact = false,
  className,
  style,
}: Props) {
  const audienceView = perspective === "audience";
  const label = audienceView ? "客席" : "舞台裏";
  const next = audienceView ? "stage" : "audience";

  return (
    <button
      type="button"
      className={className}
      aria-label={`現在は${label}側からの視点。押すと視点を反転`}
      title={`現在: ${label}側からの視点（押すと切り替え）`}
      onClick={() => onChange(next)}
      style={
        className
          ? style
          : {
              ...btnSecondary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: compact ? 3 : 5,
              minWidth: compact ? 58 : 78,
              minHeight: compact ? 32 : 28,
              padding: compact ? "4px 6px" : "3px 8px",
              borderRadius: compact ? 8 : 5,
              borderColor: "#38bdf8",
              color: "#e0f2fe",
              background: "rgba(14,116,144,0.2)",
              fontSize: compact ? 10 : 11,
              fontWeight: 750,
              lineHeight: 1,
              whiteSpace: "nowrap",
              ...style,
            }
      }
    >
      <svg
        aria-hidden
        width={compact ? 15 : 16}
        height={compact ? 15 : 16}
        viewBox="0 0 16 16"
        fill="none"
        style={{ flex: "0 0 auto" }}
      >
        <path
          d="M8 2.25v11.5M4.75 5.5 8 2.25l3.25 3.25M4.75 10.5 8 13.75l3.25-3.25"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}

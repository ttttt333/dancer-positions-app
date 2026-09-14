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

type StageViewToggleProps = {
  stageView: "2d" | "3d";
  onChange: (next: "2d" | "3d") => void;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** 編集画面: 2D / 3D 表示の切り替え（視点トグルの直下に置く想定） */
export function EditorStageView3DToggle({
  stageView,
  onChange,
  compact = false,
  className,
  style,
}: StageViewToggleProps) {
  const is3d = stageView === "3d";
  return (
    <button
      type="button"
      className={className}
      aria-pressed={is3d}
      aria-label={is3d ? "3D表示中。押すと2Dに戻す" : "3D表示に切り替える"}
      title={
        is3d
          ? "3D表示中（押すと2Dに戻る）。身長入力がある場合は高さに反映"
          : "3Dで立体表示（身長入力があれば高さに反映）"
      }
      onClick={() => onChange(is3d ? "2d" : "3d")}
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
              borderColor: is3d ? "#a78bfa" : "#64748b",
              color: is3d ? "#ede9fe" : "#e2e8f0",
              background: is3d
                ? "rgba(91, 33, 182, 0.35)"
                : "rgba(15, 23, 42, 0.88)",
              fontSize: compact ? 10 : 11,
              fontWeight: 750,
              lineHeight: 1,
              whiteSpace: "nowrap",
              ...style,
            }
      }
    >
      <span aria-hidden style={{ letterSpacing: "0.02em" }}>
        3D
      </span>
    </button>
  );
}

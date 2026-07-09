import type { CSSProperties } from "react";

type Props = {
  showAll: boolean;
  onToggle: () => void;
  hiddenCount?: number;
  style?: CSSProperties;
};

/** 雛形ピッカー共通: Tier3（マニアック）の表示切替 */
export function FormationPresetTierToggle({
  showAll,
  onToggle,
  hiddenCount,
  style,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showAll}
      title={
        showAll
          ? "定番・よく使う雛形だけ表示する"
          : "マニアックな雛形もすべて表示する"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 10px",
        borderRadius: "6px",
        border: `1px solid ${showAll ? "#d4af37" : "#334155"}`,
        background: showAll ? "rgba(212,175,55,0.12)" : "#0f172a",
        color: showAll ? "#f5e199" : "#94a3b8",
        fontSize: "11px",
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1.3,
        ...style,
      }}
    >
      {showAll ? "定番のみ" : "すべて表示"}
      {!showAll && hiddenCount != null && hiddenCount > 0 ? (
        <span style={{ fontSize: "10px", opacity: 0.85 }}>+{hiddenCount}</span>
      ) : null}
    </button>
  );
}

import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

type StarProps = {
  active: boolean;
  onToggle: () => void;
  /** カード内の右下に重ねる */
  corner?: boolean;
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
};

/** 雛形カード右下の★（クリックでお気に入り登録／解除）。親が button のため span で実装 */
export function FormationPresetFavoriteStar({
  active,
  onToggle,
  corner = true,
  disabled,
  title,
  style,
}: StarProps) {
  const handleActivate = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onToggle();
  };

  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      className="formation-preset-favorite-star"
      aria-pressed={active}
      aria-label={active ? "お気に入りを解除" : "お気に入りに追加"}
      title={title ?? (active ? "お気に入りを解除" : "お気に入りに追加")}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate(e);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        ...(corner
          ? {
              position: "absolute",
              right: 2,
              bottom: 2,
              zIndex: 2,
            }
          : {}),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        padding: 0,
        border: "none",
        borderRadius: 6,
        background: active ? "rgba(212,175,55,0.22)" : "rgba(15,23,42,0.72)",
        color: active ? "#f5e199" : "#64748b",
        fontSize: 13,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        userSelect: "none",
        ...style,
      }}
    >
      {active ? "★" : "☆"}
    </span>
  );
}

type FilterProps = {
  active: boolean;
  onToggle: () => void;
  count?: number;
  style?: CSSProperties;
};

/**
 * お気に入りのみ表示トグル（右下フッター用の小さな★）。
 * オンのときお気に入り登録した雛形だけを一覧に出す。
 */
export function FormationPresetFavoritesFilter({
  active,
  onToggle,
  count,
  style,
}: FilterProps) {
  return (
    <button
      type="button"
      className="formation-preset-favorites-filter"
      aria-pressed={active}
      title={
        active
          ? "すべての雛形を表示する"
          : "お気に入りの雛形だけ表示する"
      }
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minWidth: 36,
        height: 36,
        padding: "0 10px",
        borderRadius: 8,
        border: `1px solid ${active ? "#d4af37" : "#334155"}`,
        background: active ? "rgba(212,175,55,0.2)" : "rgba(15,23,42,0.94)",
        color: active ? "#f5e199" : "#94a3b8",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        lineHeight: 1,
        ...style,
      }}
    >
      <span aria-hidden>{active ? "★" : "☆"}</span>
      {count != null && count > 0 ? (
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{count}</span>
      ) : null}
    </button>
  );
}

import { useState, type CSSProperties } from "react";

export type StageDockQuickSection = "shape" | "display" | "sort";
export type StageDuplicatePlacement = "end" | "after";

export type StageDancerDockQuickMenuProps = {
  showShape: boolean;
  showDisplay: boolean;
  showSort: boolean;
  onPick: (section: StageDockQuickSection) => void;
  onDuplicate?: (placement: StageDuplicatePlacement) => void;
  onOpenLegacyMore?: () => void;
  onDelete?: () => void;
};

const itemBtn: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "#e2e8f0",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};

const subItemBtn: CSSProperties = {
  ...itemBtn,
  padding: "8px 12px 8px 18px",
  fontSize: 12,
  fontWeight: 600,
  color: "#cbd5e1",
};

/**
 * 選択中の右クリック用。右ドックの 雛形 / 表示 / 並べ替え / 複製 をすぐ選ぶ一覧。
 */
export function StageDancerDockQuickMenu({
  showShape,
  showDisplay,
  showSort,
  onPick,
  onDuplicate,
  onOpenLegacyMore,
  onDelete,
}: StageDancerDockQuickMenuProps) {
  const [dupOpen, setDupOpen] = useState(false);
  const entries: { id: StageDockQuickSection; label: string; hint: string }[] =
    [];
  if (showShape) {
    entries.push({ id: "shape", label: "雛形", hint: "隊形を選ぶ" });
  }
  if (showDisplay) {
    entries.push({ id: "display", label: "表示", hint: "名前・色・大きさ" });
  }
  if (showSort) {
    entries.push({ id: "sort", label: "並べ替え", hint: "身長・列・反転" });
  }

  return (
    <div data-dancer-dock-quick-menu role="menu" aria-label="ステージ操作">
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "#94a3b8",
          padding: "2px 8px 6px",
        }}
      >
        クイック操作
      </div>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="menuitem"
          style={itemBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(251,191,36,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          onClick={() => onPick(entry.id)}
        >
          <span>{entry.label}</span>
          <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>
            {entry.hint}
          </span>
        </button>
      ))}
      {onDuplicate ? (
        <>
          <button
            type="button"
            role="menuitem"
            aria-expanded={dupOpen}
            style={itemBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(56,189,248,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onClick={() => setDupOpen((v) => !v)}
          >
            <span>複製</span>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>
              {dupOpen ? "▾" : "▸"}
            </span>
          </button>
          {dupOpen ? (
            <>
              <button
                type="button"
                role="menuitem"
                style={subItemBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(56,189,248,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                onClick={() => onDuplicate("end")}
              >
                <span>一番最後に複製</span>
              </button>
              <button
                type="button"
                role="menuitem"
                style={subItemBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(56,189,248,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                onClick={() => onDuplicate("after")}
              >
                <span>すぐ後に複製</span>
              </button>
            </>
          ) : null}
        </>
      ) : null}
      {onDelete || onOpenLegacyMore ? (
        <div
          style={{
            height: 1,
            background: "#334155",
            margin: "4px 6px",
          }}
        />
      ) : null}
      {onDelete ? (
        <button
          type="button"
          role="menuitem"
          style={{ ...itemBtn, color: "#fca5a5" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(248,113,113,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          onClick={onDelete}
        >
          <span>削除</span>
        </button>
      ) : null}
      {onOpenLegacyMore ? (
        <button
          type="button"
          role="menuitem"
          style={{ ...itemBtn, color: "#94a3b8", fontWeight: 600 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(148,163,184,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          onClick={onOpenLegacyMore}
        >
          <span>その他の操作…</span>
        </button>
      ) : null}
    </div>
  );
}

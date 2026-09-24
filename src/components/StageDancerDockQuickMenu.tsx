import { useState, type CSSProperties } from "react";
import type { GatherToward } from "../lib/gatherDancers";
import { STAGE_GATHER_EDGE_ACTIONS } from "./StageGatherToEdgeButtons";

export type StageDockQuickSection = "shape" | "display" | "sort";
export type StageDuplicatePlacement = "end" | "after";

export type StageDancerDockQuickMenuProps = {
  showShape: boolean;
  showDisplay: boolean;
  showSort: boolean;
  onPick: (section: StageDockQuickSection) => void;
  onDuplicate?: (placement: StageDuplicatePlacement) => void;
  /** ちょうど2人選択時: 立ち位置を入れ替え */
  onSwapPair?: () => void;
  /** 選択メンバーを辺へ寄せる */
  onGatherToEdge?: (
    toward: Extract<GatherToward, "shimote" | "kamite" | "back">
  ) => void;
  onOpenLegacyMore?: () => void;
  onDelete?: () => void;
  /** 照明を追加（種類ごと） */
  lightAddOptions?: { kind: string; label: string }[];
  onAddLight?: (kind: string) => void;
};

const itemBtn: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};

const subItemBtn: CSSProperties = {
  ...itemBtn,
  padding: "5px 10px 5px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "#cbd5e1",
};

/**
 * 選択中の右クリック／ダブルクリック用。右ドックの操作をすぐ選ぶ一覧。
 */
export function StageDancerDockQuickMenu({
  showShape,
  showDisplay,
  showSort,
  onPick,
  onDuplicate,
  onSwapPair,
  onGatherToEdge,
  onOpenLegacyMore,
  onDelete,
  lightAddOptions,
  onAddLight,
}: StageDancerDockQuickMenuProps) {
  const [dupOpen, setDupOpen] = useState(false);
  const [gatherOpen, setGatherOpen] = useState(true);
  const [lightOpen, setLightOpen] = useState(
    () =>
      !showShape &&
      !showDisplay &&
      !showSort &&
      !onDuplicate &&
      !onDelete &&
      !onSwapPair &&
      !onGatherToEdge
  );
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
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "#94a3b8",
          padding: "1px 6px 4px",
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
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
            {entry.hint}
          </span>
        </button>
      ))}
      {onGatherToEdge ? (
        <>
          <button
            type="button"
            role="menuitem"
            aria-expanded={gatherOpen}
            style={itemBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(251,191,36,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onClick={() => setGatherOpen((v) => !v)}
          >
            <span>辺に寄せる</span>
            <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
              {gatherOpen ? "▾" : "▸"}
            </span>
          </button>
          {gatherOpen
            ? STAGE_GATHER_EDGE_ACTIONS.map((a) => (
                <button
                  key={a.toward}
                  type="button"
                  role="menuitem"
                  style={subItemBtn}
                  title={a.title}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(251,191,36,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => onGatherToEdge(a.toward)}
                >
                  <span>
                    {a.toward === "back"
                      ? "舞台後ろに寄せる"
                      : `${a.label}に寄せる`}
                  </span>
                </button>
              ))
            : null}
        </>
      ) : null}
      {onSwapPair ? (
        <button
          type="button"
          role="menuitem"
          style={itemBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(56,189,248,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          onClick={onSwapPair}
        >
          <span>二人を入れ替え</span>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
            立ち位置を交換
          </span>
        </button>
      ) : null}
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
            <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
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
      {onAddLight && lightAddOptions && lightAddOptions.length > 0 ? (
        <>
          <div
            style={{
              height: 1,
              background: "#334155",
              margin: "3px 6px",
            }}
          />
          <button
            type="button"
            role="menuitem"
            aria-expanded={lightOpen}
            style={itemBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(251,191,36,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onClick={() => setLightOpen((v) => !v)}
          >
            <span>照明を追加</span>
            <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
              {lightOpen ? "▾" : "▸"}
            </span>
          </button>
          {lightOpen
            ? lightAddOptions.map((opt) => (
                <button
                  key={opt.kind}
                  type="button"
                  role="menuitem"
                  style={subItemBtn}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(251,191,36,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => onAddLight(opt.kind)}
                >
                  <span>＋{opt.label}</span>
                </button>
              ))
            : null}
        </>
      ) : null}
      {onDelete || onOpenLegacyMore ? (
        <div
          style={{
            height: 1,
            background: "#334155",
            margin: "3px 6px",
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

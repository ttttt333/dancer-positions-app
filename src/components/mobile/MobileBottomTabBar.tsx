/**
 * MobileBottomTabBar — 4 タブバー
 *
 * STAGE / CUES / ＋ADD / ⋯MORE
 * safe-area-inset-bottom 対応。
 */
import type { CSSProperties } from "react";
import { shell } from "../../theme/choreoShell";

export type MobileTab = "stage" | "cues" | "add" | "more";

export type MobileBottomTabBarProps = {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  /** ADD タップ時に即ダイアログ開く */
  onAdd: () => void;
  isView?: boolean;
};

// ── Icons ──────────────────────────────────────────────────────────────────

function IconStage({ active }: { active: boolean }) {
  const c = active ? shell.accent : shell.textMuted;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M3 18 L6 6 L18 6 L21 18 Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" fill={active ? shell.accent + "18" : "none"} />
      <circle cx="9" cy="11" r="1.3" fill={c} />
      <circle cx="12" cy="10.5" r="1.5" fill={c} />
      <circle cx="15" cy="11" r="1.3" fill={c} />
    </svg>
  );
}

function IconCues({ active }: { active: boolean }) {
  const c = active ? "#38bdf8" : shell.textMuted;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <rect x="3" y="4" width="18" height="4" rx="1.5" stroke={c} strokeWidth="1.4" fill={active ? c + "20" : "none"} />
      <rect x="3" y="10" width="18" height="4" rx="1.5" stroke={c} strokeWidth="1.4" fill={active ? c + "18" : "none"} />
      <rect x="3" y="16" width="11" height="4" rx="1.5" stroke={c} strokeWidth="1.4" fill={active ? c + "14" : "none"} />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="9.5" stroke="#22c55e" strokeWidth="1.5" fill="#22c55e20" />
      <path d="M12 7.5 V16.5 M7.5 12 H16.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMore({ active }: { active: boolean }) {
  const c = active ? shell.accent : shell.textMuted;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="5" cy="12" r="1.8" fill={c} />
      <circle cx="12" cy="12" r="1.8" fill={c} />
      <circle cx="19" cy="12" r="1.8" fill={c} />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function MobileBottomTabBar({
  activeTab,
  onTabChange,
  onAdd,
  isView = false,
}: MobileBottomTabBarProps) {
  const tabBtn = (tab: MobileTab, active: boolean): CSSProperties => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: "6px 0 4px",
    background: "none",
    border: "none",
    cursor: "pointer",
    opacity: 1,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    position: "relative",
  });

  const label = (text: string, active: boolean, color: string): CSSProperties => ({
    fontSize: 10,
    fontWeight: active ? 700 : 500,
    color: active ? color : shell.textSubtle,
    letterSpacing: "0.04em",
    lineHeight: 1,
  });

  const addBtnStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: "6px 0 4px",
    background: "none",
    border: "none",
    cursor: isView ? "not-allowed" : "pointer",
    opacity: isView ? 0.35 : 1,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        background: shell.bgChrome,
        borderTop: `1px solid ${shell.borderStrong}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        flexShrink: 0,
      }}
    >
      {/* Active indicator bar at top */}
      <style>{`
        .mobile-tab-active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 2px;
          border-radius: 0 0 2px 2px;
        }
      `}</style>

      {/* STAGE */}
      <button
        type="button"
        style={tabBtn("stage", activeTab === "stage")}
        onClick={() => onTabChange("stage")}
        aria-label="ステージ"
      >
        {activeTab === "stage" && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, borderRadius: "0 0 2px 2px", background: shell.accent }} />
        )}
        <IconStage active={activeTab === "stage"} />
        <span style={label("STAGE", activeTab === "stage", shell.accent)}>STAGE</span>
      </button>

      {/* CUES */}
      <button
        type="button"
        style={tabBtn("cues", activeTab === "cues")}
        onClick={() => onTabChange("cues")}
        aria-label="キュー一覧"
      >
        {activeTab === "cues" && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, borderRadius: "0 0 2px 2px", background: "#38bdf8" }} />
        )}
        <IconCues active={activeTab === "cues"} />
        <span style={label("CUES", activeTab === "cues", "#38bdf8")}>CUES</span>
      </button>

      {/* ＋ADD */}
      <button
        type="button"
        style={addBtnStyle}
        disabled={isView}
        onClick={onAdd}
        aria-label="キューを追加"
      >
        <IconAdd />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#22c55e", letterSpacing: "0.04em", lineHeight: 1 }}>ADD</span>
      </button>

      {/* ⋯MORE */}
      <button
        type="button"
        style={tabBtn("more", activeTab === "more")}
        onClick={() => onTabChange(activeTab === "more" ? "stage" : "more")}
        aria-label="ツールメニュー"
      >
        {activeTab === "more" && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, borderRadius: "0 0 2px 2px", background: shell.accent }} />
        )}
        <IconMore active={activeTab === "more"} />
        <span style={label("MORE", activeTab === "more", shell.accent)}>MORE</span>
      </button>
    </div>
  );
}

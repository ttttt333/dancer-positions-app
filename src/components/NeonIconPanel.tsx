import { type CSSProperties, type ReactNode } from "react";
import { shell } from "../theme/choreoShell";
import type { ChoreoCoreToolbarCoreProps } from "./ChoreoCoreToolbar";

/* ═══════════════════════════════════════════════════════════
   NeonIconPanel — matches ChoreoCore v2 RightPanel exactly
   Purple/indigo neon color scheme
   ═══════════════════════════════════════════════════════════ */

type NeonIconPanelProps = ChoreoCoreToolbarCoreProps & {
  layout?: "column" | "row";
  embedInPanel?: boolean;
  tilesInRun?: boolean;
  dense?: boolean;
  showBrand?: boolean;
  singleTile?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  onSave?: () => void;
  onAddDancer?: () => void;
  onOpenRoster?: () => void;
  onOpenCueList?: () => void;
  onOpenShareLinks?: () => void;
  onOpenAISuggest?: () => void;
  onOpenFloorText?: () => void;
  onOpenViewMode?: () => void;
  onZoomStage?: () => void;
  onOpenAudioImport?: () => void;
  onOpenLibrary?: () => void;
  onOpenRosterImport?: () => void;
  onOpenStageTransform?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
};

/* ─── Glow filter helper ─── */
const glow = (c: string) =>
  `drop-shadow(0 0 4px ${c}60) drop-shadow(0 0 8px ${c}30)`;

/* ─── Neon SVG Icons — v2 exact colors ─── */
function IconStage() {
  const c = "#c084fc";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <path d="M6 10 L26 10 L30 26 L2 26 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="16" y1="6" x2="16" y2="10" stroke={c} strokeWidth="1.2" />
      <circle cx="16" cy="5" r="1.5" fill={c} />
    </svg>
  );
}
function IconCueFlag() {
  const c = "#c084fc";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <line x1="9" y1="6" x2="9" y2="28" stroke={c} strokeWidth="1.5" />
      <path d="M9 6 L24 10 L9 14 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="14" y1="8" x2="14" y2="12" stroke={c} strokeWidth="0.8" opacity="0.5" />
      <line x1="18" y1="8.8" x2="18" y2="11.5" stroke={c} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}
function IconSavePosition() {
  const c = "#818cf8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <circle cx="16" cy="12" r="4" fill="none" stroke={c} strokeWidth="1.5" />
      <circle cx="16" cy="12" r="1.5" fill={c} />
      <path d="M16 16 L16 27" stroke={c} strokeWidth="1.5" />
      <path d="M12 24 L16 28 L20 24" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}
function IconText() {
  const c = "#c084fc";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <text x="6" y="22" fontFamily="sans-serif" fontWeight="bold" fontSize="18" fill="none" stroke={c} strokeWidth="1.2">T</text>
      <line x1="20" y1="20" x2="27" y2="27" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 18 L22 22" stroke={c} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}
function IconZoomIn() {
  const c = "#60a5fa";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <circle cx="14" cy="14" r="8" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="20" y1="20" x2="28" y2="28" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="14" x2="17" y2="14" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="11" x2="14" y2="17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconViewMode() {
  const c = "#818cf8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <rect x="4" y="6" width="24" height="18" rx="2" fill="none" stroke={c} strokeWidth="1.5" />
      <ellipse cx="16" cy="15" rx="5" ry="3.5" fill="none" stroke={c} strokeWidth="1.2" />
      <circle cx="16" cy="15" r="1.5" fill={c} />
      <line x1="4" y1="26" x2="28" y2="26" stroke={c} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}
function IconGrid() {
  const c = "#a78bfa";
  return (
    <svg viewBox="0 0 20 20" style={{ filter: glow(c), width: 16, height: 16 }}>
      <line x1="7" y1="2" x2="7" y2="18" stroke={c} strokeWidth="1" />
      <line x1="13" y1="2" x2="13" y2="18" stroke={c} strokeWidth="1" />
      <line x1="2" y1="7" x2="18" y2="7" stroke={c} strokeWidth="1" />
      <line x1="2" y1="13" x2="18" y2="13" stroke={c} strokeWidth="1" />
    </svg>
  );
}
function IconMagnet() {
  const c = "#a78bfa";
  return (
    <svg viewBox="0 0 20 20" style={{ filter: glow(c), width: 16, height: 16 }}>
      <path d="M5 4 L5 12 C5 15.3 7.7 18 11 18 C14.3 18 17 15.3 17 12 L17 4" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="3" y1="4" x2="7" y2="4" stroke={c} strokeWidth="1.5" />
      <line x1="15" y1="4" x2="19" y2="4" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}
function IconCueList() {
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow("#fbbf24") }}>
      <rect x="4" y="4" width="10" height="7" rx="1.5" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      <text x="6.5" y="9.5" fontSize="5.5" fontWeight="bold" fill="#fbbf24" fontFamily="sans-serif">1</text>
      <rect x="4" y="13" width="10" height="7" rx="1.5" fill="none" stroke="#fb923c" strokeWidth="1.2" />
      <text x="6.5" y="18.5" fontSize="5.5" fontWeight="bold" fill="#fb923c" fontFamily="sans-serif">2</text>
      <rect x="4" y="22" width="10" height="7" rx="1.5" fill="none" stroke="#f87171" strokeWidth="1.2" />
      <text x="6.5" y="27.5" fontSize="5.5" fontWeight="bold" fill="#f87171" fontFamily="sans-serif">3</text>
      <line x1="17" y1="7.5" x2="28" y2="7.5" stroke="#fbbf24" strokeWidth="1" opacity="0.7" />
      <line x1="17" y1="16.5" x2="26" y2="16.5" stroke="#fb923c" strokeWidth="1" opacity="0.7" />
      <line x1="17" y1="25.5" x2="24" y2="25.5" stroke="#f87171" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}
function IconAudioImport() {
  const c = "#f472b6";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <path d="M4 16 Q6 10 8 16 Q10 22 12 16 Q14 10 16 16 Q18 22 20 16 Q22 10 24 16 Q26 22 28 16" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="16" y1="20" x2="16" y2="28" stroke={c} strokeWidth="1.5" />
      <path d="M12 24 L16 28 L20 24" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}
function IconLibrary() {
  const c = "#22d3ee";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <rect x="5" y="8" width="22" height="18" rx="2" fill="none" stroke={c} strokeWidth="1.5" />
      <polyline points="5,12 12,12 14,8" fill="none" stroke={c} strokeWidth="1.2" />
      <path d="M16 17 L17.5 20 L21 20.5 L18.5 23 L19 26.5 L16 25 L13 26.5 L13.5 23 L11 20.5 L14.5 20 Z" fill="none" stroke={c} strokeWidth="1" />
    </svg>
  );
}
function IconAddMember() {
  const c = "#34d399";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <circle cx="14" cy="11" r="5" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M6 27 C6 21 10 18 14 18 C18 18 22 21 22 27" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="24" y1="8" x2="24" y2="16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="12" x2="28" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconRosterImport() {
  const c = "#34d399";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <rect x="6" y="4" width="20" height="24" rx="2" fill="none" stroke={c} strokeWidth="1.5" />
      <line x1="10" y1="10" x2="22" y2="10" stroke={c} strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="14" x2="20" y2="14" stroke={c} strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="18" x2="18" y2="18" stroke={c} strokeWidth="1" opacity="0.5" />
      <path d="M16 20 L16 27" stroke={c} strokeWidth="1.5" />
      <path d="M13 24 L16 27 L19 24" fill="none" stroke={c} strokeWidth="1.2" />
      <rect x="8" y="9" width="2" height="2" rx="0.5" fill={c} opacity="0.6" />
      <rect x="8" y="13" width="2" height="2" rx="0.5" fill={c} opacity="0.6" />
    </svg>
  );
}
function IconMemberView() {
  const c = "#34d399";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <circle cx="8" cy="11" r="3.5" fill="none" stroke={c} strokeWidth="1.2" />
      <circle cx="16" cy="9" r="4" fill="none" stroke={c} strokeWidth="1.5" />
      <circle cx="24" cy="11" r="3.5" fill="none" stroke={c} strokeWidth="1.2" />
      <path d="M4 26 C4 21 6 19 8 19" fill="none" stroke={c} strokeWidth="1.2" opacity="0.7" />
      <path d="M10 20 C12 17 14 16 16 16 C18 16 20 17 22 20" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M24 19 C26 19 28 21 28 26" fill="none" stroke={c} strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}
function IconShareUrl() {
  const c = "#60a5fa";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <path d="M13 19 L19 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 21 C8 24 8 24 10 26 C12 28 12 28 15 25" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M17 11 C20 8 20 8 22 10 C24 12 24 12 21 15" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M22 6 L26 2 L30 6" fill="none" stroke={c} strokeWidth="1.2" />
      <line x1="26" y1="2" x2="26" y2="12" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}
function IconStageTransform() {
  const c = "#c084fc";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      {/* Stage base shape morphing */}
      <path d="M4 12 L16 6 L28 12 L24 28 L8 28 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 2" />
      {/* Transform arrows at corners */}
      <path d="M4 12 L2 9" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M28 12 L30 9" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 28 L5 30" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 28 L27 30" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      {/* Center morph indicator */}
      <circle cx="16" cy="18" r="2" fill="none" stroke={c} strokeWidth="1" />
      <path d="M14 18 L12 18" stroke={c} strokeWidth="1" strokeLinecap="round" />
      <path d="M18 18 L20 18" stroke={c} strokeWidth="1" strokeLinecap="round" />
      <path d="M16 16 L16 14" stroke={c} strokeWidth="1" strokeLinecap="round" />
      <path d="M16 20 L16 22" stroke={c} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
function IconExportPackage() {
  const c = "#818cf8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <path d="M6 12 L16 6 L26 12 L26 24 L16 30 L6 24 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="16" y1="6" x2="16" y2="18" stroke={c} strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="12" x2="16" y2="18" stroke={c} strokeWidth="1" opacity="0.4" />
      <line x1="26" y1="12" x2="16" y2="18" stroke={c} strokeWidth="1" opacity="0.4" />
      <line x1="16" y1="2" x2="16" y2="10" stroke={c} strokeWidth="1.5" />
      <path d="M13 5 L16 2 L19 5" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}
function IconAISuggest() {
  const c = "#e879f9";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <path d="M16 4 L18 10 L24 10 L19 14 L21 20 L16 16 L11 20 L13 14 L8 10 L14 10 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="25" cy="6" r="2" fill="none" stroke={c} strokeWidth="1" opacity="0.6" />
      <circle cx="7" cy="24" r="1.5" fill="none" stroke={c} strokeWidth="1" opacity="0.4" />
      <path d="M12 24 C12 28 20 28 20 24" fill="none" stroke={c} strokeWidth="1.2" />
      <text x="13.5" y="30" fontSize="5" fontWeight="bold" fill={c} fontFamily="sans-serif" opacity="0.7">AI</text>
    </svg>
  );
}
function IconSetPiece() {
  const c = "#a78bfa";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <rect x="10" y="4" width="12" height="2" rx="1" fill="none" stroke={c} strokeWidth="1.2" />
      <line x1="12" y1="6" x2="10" y2="20" stroke={c} strokeWidth="1.2" />
      <line x1="20" y1="6" x2="22" y2="20" stroke={c} strokeWidth="1.2" />
      <rect x="4" y="20" width="24" height="3" rx="1" fill="none" stroke={c} strokeWidth="1.2" />
      <line x1="8" y1="23" x2="6" y2="30" stroke={c} strokeWidth="1.2" />
      <line x1="24" y1="23" x2="26" y2="30" stroke={c} strokeWidth="1.2" />
      <circle cx="27" cy="8" r="5" fill="none" stroke={c} strokeWidth="1" />
      <line x1="27" y1="5.5" x2="27" y2="10.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24.5" y1="8" x2="29.5" y2="8" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IconHelp() {
  const c = "#818cf8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c) }}>
      <circle cx="16" cy="16" r="12" fill="none" stroke={c} strokeWidth="1.5" />
      <text x="16" y="21" textAnchor="middle" fontSize="15" fontWeight="bold" fill={c} fontFamily="sans-serif">?</text>
    </svg>
  );
}
function IconUndo() {
  const c = "#94a3b8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c), width: 20, height: 20 }}>
      <path d="M10 8 L4 14 L10 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14 L20 14 C24 14 28 18 28 22 C28 26 24 28 20 28 L16 28" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconRedo() {
  const c = "#94a3b8";
  return (
    <svg viewBox="0 0 32 32" style={{ filter: glow(c), width: 20, height: 20 }}>
      <path d="M22 8 L28 14 L22 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 14 L12 14 C8 14 4 18 4 22 C4 26 8 28 12 28 L16 28" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── NeonBtn ─── */
const btnBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  padding: "4px 2px",
  cursor: "pointer",
  transition: "all 0.2s",
  aspectRatio: "1",
};
const btnActiveExtra: CSSProperties = {
  background: "rgba(99,102,241,0.15)",
  borderColor: "rgba(99,102,241,0.3)",
  boxShadow: "0 0 12px rgba(99,102,241,0.15)",
};
const btnDisabledExtra: CSSProperties = {
  opacity: 0.3,
  cursor: "not-allowed",
};
const iconSize: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
};
const labelStyle: CSSProperties = {
  fontSize: 9,
  color: "rgba(255,255,255,0.5)",
  lineHeight: 1,
  textAlign: "center",
  whiteSpace: "nowrap",
  marginTop: 2,
};

function NeonBtn({ icon, label, onClick, active, disabled }: {
  icon: ReactNode; label: string; onClick?: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        ...btnBase,
        ...(active ? btnActiveExtra : {}),
        ...(disabled ? btnDisabledExtra : {}),
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
        }
      }}
      title={label}
    >
      <div style={iconSize}>{icon}</div>
      <span style={labelStyle}>{label}</span>
    </button>
  );
}

/* ─── Divider ─── */
function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.04)", gridColumn: "1 / -1" }} />;
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

export function NeonIconPanel({
  snapGrid,
  onToggleSnapGrid,
  onToggleStageGridLines,
  stageGridLinesEnabled,
  stageShapeActive,
  onOpenStageShapePicker,
  onOpenSetPiecePicker,
  onOpenShortcutsHelp,
  onOpenExport,
  disabled,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  onSave,
  onAddDancer,
  onOpenRoster,
  onOpenCueList,
  onOpenShareLinks,
  onOpenAISuggest,
  onOpenFloorText,
  onOpenViewMode,
  onZoomStage,
  onOpenAudioImport,
  onOpenLibrary,
  onOpenRosterImport,
  onOpenStageTransform,
  collapsed = false,
  onCollapseToggle,
}: NeonIconPanelProps) {
  const gridSnap = stageGridLinesEnabled ?? false;

  /* ── Collapsed thin-bar mode ── */
  if (collapsed) {
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          width: 28,
          background: "rgba(10,10,20,0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          paddingTop: 8,
          gap: 8,
          height: "100%",
          transition: "width 0.18s ease",
        }}
      >
        <button
          type="button"
          title="パネルを展開"
          onClick={onCollapseToggle}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
            color: "#c084fc",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
          }}
        >
          ›
        </button>
        {/* Rotated label */}
        <div
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            fontSize: 9,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: 1,
            marginTop: 4,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          ツール
        </div>
      </div>
    );
  }

  const grid3: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 4,
  };

  const panelStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: 232,
    background: "rgba(10,10,20,0.90)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderLeft: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
    padding: "8px 10px",
    gap: 6,
    overflowY: "auto",
    height: "100%",
  };

  const snapToggleRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  const toggleTrack: CSSProperties = {
    position: "relative",
    width: 32,
    height: 18,
    borderRadius: 9,
    background: gridSnap ? "#6366f1" : "rgba(255,255,255,0.1)",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.2s",
    border: "none",
    padding: 0,
  };
  const toggleThumb: CSSProperties = {
    position: "absolute",
    top: 2,
    left: gridSnap ? 14 : 2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    transition: "left 0.2s",
  };

  return (
    <div style={panelStyle}>
      {/* Collapse toggle button */}
      {onCollapseToggle && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
          <button
            type="button"
            title="パネルを折りたたむ"
            onClick={onCollapseToggle}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.25)",
              color: "rgba(192,132,252,0.7)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            ›
          </button>
        </div>
      )}
      {/* Block 1: 舞台・編集 (3×2) */}
      <div style={grid3}>
        <NeonBtn icon={<IconStage />} label="舞台設定" onClick={onOpenStageShapePicker} active={stageShapeActive} disabled={disabled} />
        <NeonBtn icon={<IconCueFlag />} label="キュー設定" onClick={onOpenCueList} disabled={disabled} />
        <NeonBtn icon={<IconSavePosition />} label="立ち位置保存" onClick={onSave} disabled={disabled} />
        <NeonBtn icon={<IconText />} label="テキスト" onClick={onOpenFloorText} disabled={disabled} />
        <NeonBtn icon={<IconZoomIn />} label="拡大" onClick={onZoomStage} disabled={disabled} />
        <NeonBtn icon={<IconViewMode />} label="閲覧モード" onClick={onOpenViewMode} disabled={disabled} />
      </div>

      {/* Grid snap toggle */}
      <div style={snapToggleRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconGrid />
          <IconMagnet />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 500, lineHeight: 1 }}>グリッド吸着</div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{gridSnap ? "ON" : "OFF"} — 格子点に自動整列</div>
        </div>
        <button type="button" style={toggleTrack} onClick={onToggleStageGridLines}>
          <div style={toggleThumb} />
        </button>
      </div>

      <Divider />

      {/* Block 2: キュー (2×1) */}
      <div style={grid3}>
        <NeonBtn icon={<IconCueList />} label="キュー一覧" onClick={onOpenCueList} disabled={disabled} />
        <NeonBtn icon={<IconLibrary />} label="ライブラリ" onClick={onOpenLibrary} disabled={disabled} />
        <div />
      </div>

      <Divider />

      {/* Block 3: メンバー (3×1) */}
      <div style={grid3}>
        <NeonBtn icon={<IconAddMember />} label="+メンバー" onClick={onAddDancer} disabled={disabled} />
        <NeonBtn icon={<IconRosterImport />} label="名簿取込" onClick={onOpenRosterImport} disabled={disabled} />
        <NeonBtn icon={<IconMemberView />} label="メンバー表示" onClick={onOpenRoster} disabled={disabled} />
      </div>

      <Divider />

      {/* Block 4: 共有・出力 (3×2) */}
      <div style={grid3}>
        <NeonBtn icon={<IconShareUrl />} label="共有URL" onClick={onOpenShareLinks} disabled={disabled} />
        <NeonBtn icon={<IconStageTransform />} label="舞台変形" onClick={onOpenStageTransform} disabled={disabled} />
        <NeonBtn icon={<IconExportPackage />} label="エクスポート" onClick={onOpenExport} disabled={disabled} />
        <NeonBtn icon={<IconAISuggest />} label="AI提案" onClick={onOpenAISuggest} disabled={disabled} />
        <NeonBtn icon={<IconSetPiece />} label="大道具" onClick={onOpenSetPiecePicker} disabled={disabled} />
        <NeonBtn icon={<IconHelp />} label="ヘルプ" onClick={onOpenShortcutsHelp} disabled={disabled} />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Undo / Redo */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 4 }}>
        <div style={grid3}>
          <NeonBtn icon={<IconUndo />} label="元に戻す" onClick={onUndo} disabled={undoDisabled ?? disabled} />
          <NeonBtn icon={<IconRedo />} label="やり直す" onClick={onRedo} disabled={redoDisabled ?? disabled} />
          <div />
        </div>
      </div>
    </div>
  );
}

export default NeonIconPanel;

import type { CSSProperties, ReactNode } from "react";
import { shell } from "../theme/choreoShell";
import { btnSecondary } from "./stageButtonStyles";
import { ChoreoGridLogo } from "./ChoreoGridLogo";

type Props = {
  /** 既定は縦（旧左列）。右列に置くときは row */
  layout?: "column" | "row";
  /**
   * ステージ列と同じ `panelCard` 内に置くとき true。
   * 外枠・背景を付けず、ボタンを縦に幅いっぱいに並べる。
   */
  embedInPanel?: boolean;
  snapGrid?: boolean;
  onToggleSnapGrid: () => void;
  stageGridLinesEnabled?: boolean;
  onToggleStageGridLines?: () => void;
  stageGridLinesToggleDisabled?: boolean;
  stageShapeActive?: boolean;
  onOpenStageShapePicker: () => void;
  onOpenSetPiecePicker: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenExport: () => void;
  disabled?: boolean;
};

const iconWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
};

function IconSnap({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <path
        d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.85}
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" opacity={active ? 0.95 : 0.35} />
    </svg>
  );
}

function IconGridLines({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.45}
      />
      {[7, 11, 15].map((y) => (
        <line
          key={y}
          x1="5"
          y1={y}
          x2="19"
          y2={y}
          stroke="currentColor"
          strokeWidth={on ? 1.8 : 1.2}
          strokeLinecap="round"
          opacity={on ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

function IconStageShape({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <path
        d="M5 8 L12 4 L19 8 L17 18 H7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.88}
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity={0.35}
      />
    </svg>
  );
}

function IconSetPiece() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <rect
        x="4"
        y="6"
        width="11"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <ellipse cx="17" cy="11" rx="4" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 5v10M8 9l4-4 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 17h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.8 9.2c0-1.2 1-2 2.2-2 1.35 0 2.3.85 2.3 2 0 1.9-2.5 1.7-2.5 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function ToolbarIconButton({
  title,
  onClick,
  disabled,
  pressed,
  fullWidth,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  /** 右パネルなどで横いっぱいに並べる */
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        ...btnSecondary,
        width: fullWidth ? "100%" : 42,
        height: 42,
        minWidth: fullWidth ? 0 : 42,
        minHeight: 42,
        padding: fullWidth ? "0 10px" : 0,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: fullWidth ? "flex-start" : "center",
        flexShrink: 0,
        color: pressed ? shell.text : shell.textMuted,
        borderColor: pressed ? `${shell.accent}cc` : undefined,
        background: pressed ? shell.accentSoft : undefined,
        boxShadow: pressed ? `0 0 0 1px ${shell.accentSoft}` : undefined,
      }}
    >
      <span style={iconWrap}>{children}</span>
    </button>
  );
}

/**
 * ChoreoGrid 左端ツールバー（アイコン中心・title で補足）。
 */
export function ChoreoGridToolbar({
  layout = "column",
  embedInPanel = false,
  onToggleSnapGrid,
  onToggleStageGridLines,
  stageGridLinesToggleDisabled = false,
  onOpenStageShapePicker,
  onOpenSetPiecePicker,
  onOpenShortcutsHelp,
  onOpenExport,
  disabled = false,
  snapGrid = false,
  stageGridLinesEnabled = false,
  stageShapeActive = false,
}: Props) {
  const row = layout === "row" && !embedInPanel;
  const fw = embedInPanel;
  return (
    <aside
      aria-label="ChoreoGrid ツール"
      style={{
        display: "flex",
        flexDirection: embedInPanel ? "column" : row ? "row" : "column",
        flexWrap: row ? "wrap" : "nowrap",
        alignItems: embedInPanel ? "stretch" : row ? "flex-start" : "center",
        justifyContent: row ? "flex-start" : "flex-start",
        gap: embedInPanel ? 6 : 8,
        padding: embedInPanel ? 0 : row ? "8px 10px" : "8px 5px",
        background: embedInPanel ? "transparent" : shell.surface,
        border: embedInPanel ? "none" : `1px solid ${shell.border}`,
        borderRadius: embedInPanel ? 0 : row ? "14px" : "14px",
        minWidth: embedInPanel ? 0 : row ? 0 : 54,
        maxWidth: embedInPanel ? "100%" : row ? "100%" : 58,
        width: embedInPanel ? "100%" : row ? "100%" : undefined,
        height: embedInPanel ? "auto" : row ? "auto" : "100%",
        boxSizing: "border-box",
      }}
    >
      {!embedInPanel ? (
        <div aria-hidden style={{ flexShrink: 0, lineHeight: 0 }}>
          <ChoreoGridLogo size={30} title="ChoreoGrid" />
        </div>
      ) : null}
      <ToolbarIconButton
        title="スナップ（グリッドに吸着。実寸 1cm 線が使えるときはその線に沿います）"
        disabled={disabled}
        pressed={snapGrid}
        fullWidth={fw}
        onClick={onToggleSnapGrid}
      >
        <IconSnap active={snapGrid} />
      </ToolbarIconButton>
      {onToggleStageGridLines ? (
        <ToolbarIconButton
          title={
            stageGridLinesToggleDisabled
              ? "幅・奥行（mm）を設定するとグリッド線を表示できます"
              : "実寸グリッド線をステージ上に表示（スナップとは別）"
          }
          disabled={disabled || stageGridLinesToggleDisabled}
          pressed={stageGridLinesEnabled}
          fullWidth={fw}
          onClick={onToggleStageGridLines}
        >
          <IconGridLines on={stageGridLinesEnabled} />
        </ToolbarIconButton>
      ) : null}
      <ToolbarIconButton
        title="変形舞台（花道・スラスト・台形・手描きカスタムなど）"
        disabled={disabled}
        pressed={stageShapeActive}
        fullWidth={fw}
        onClick={onOpenStageShapePicker}
      >
        <IconStageShape active={stageShapeActive} />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="大道具を追加（図形・色を選択）"
        disabled={disabled}
        fullWidth={fw}
        onClick={onOpenSetPiecePicker}
      >
        <IconSetPiece />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="書き出し（PNG / PDF / WebM / JSON）"
        disabled={disabled}
        fullWidth={fw}
        onClick={onOpenExport}
      >
        <IconExport />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="キーボードショートカット一覧"
        disabled={disabled}
        fullWidth={fw}
        onClick={onOpenShortcutsHelp}
      >
        <IconHelp />
      </ToolbarIconButton>
    </aside>
  );
}

import { useMemo, useEffect } from "react";
import styles from "./BottomNav.module.css";

export interface BottomNavProps {
  className?: string;
  onOpenMenu?: () => void;
  onOpenStageSettings?: () => void;
  onOpenAddCue?: () => void;
  onOpenExport?: () => void;
  onOpenFlowLibrary?: () => void;
  onOpenAudioImport?: () => void;
  onOpenRosterImport?: () => void;
  onOpenShareLinks?: () => void;
  onOpenFormationBox?: () => void;
  onOpenViewerMode?: () => void;
  onAddDancer?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onEnterZen?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isViewMode?: boolean;
}

export function BottomNav({ 
  className, 
  onOpenMenu,
  onOpenStageSettings,
  onOpenAddCue,
  onOpenExport,
  onOpenFlowLibrary,
  onOpenAudioImport,
  onOpenRosterImport,
  onOpenShareLinks,
  onOpenFormationBox,
  onOpenViewerMode,
  onAddDancer,
  onUndo,
  onRedo,
  onEnterZen,
  canUndo,
  canRedo,
  isViewMode
}: BottomNavProps) {

  // Add body class to prevent content overlap (mobile-safe)
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      document.body.classList.add('has-bottom-nav');
      return () => {
        document.body.classList.remove('has-bottom-nav');
      };
    }
  }, []);

  const actionButtons = useMemo(() => [
    { id: "stage", label: "舞台設定", icon: "⚙️", action: onOpenStageSettings, disabled: isViewMode },
    { id: "add", label: "＋キュー", icon: "➕", action: onOpenAddCue, disabled: isViewMode },
    { id: "dancer", label: "＋人", icon: "👤", action: onAddDancer, disabled: isViewMode },
    { id: "library", label: "ライブラリ", icon: "📚", action: onOpenFlowLibrary, disabled: false },
    { id: "audio", label: "音源", icon: "🎵", action: onOpenAudioImport, disabled: isViewMode },
    { id: "roster", label: "名簿", icon: "📋", action: onOpenRosterImport, disabled: isViewMode },
    { id: "export", label: "出力", icon: "📤", action: onOpenExport, disabled: false },
    { id: "share", label: "共有", icon: "🔗", action: onOpenShareLinks, disabled: false },
    { id: "formation", label: "保存", icon: "💾", action: onOpenFormationBox, disabled: isViewMode },
    { id: "viewer", label: "表示", icon: "👁️", action: onOpenViewerMode, disabled: false },
    { id: "zen", label: "拡大", icon: "🔍", action: onEnterZen, disabled: false },
    { id: "undo", label: "戻る", icon: "↩️", action: onUndo, disabled: !canUndo || isViewMode },
    { id: "redo", label: "進む", icon: "↪️", action: onRedo, disabled: !canRedo || isViewMode },
  ], [
    onOpenStageSettings, onOpenAddCue, onAddDancer, onOpenFlowLibrary, 
    onOpenAudioImport, onOpenRosterImport, onOpenExport, onOpenShareLinks,
    onOpenFormationBox, onOpenViewerMode, onEnterZen, onUndo, onRedo,
    canUndo, canRedo, isViewMode
  ]);

  
  return (
    <nav className={`${styles.bottomNav} ${className || ""}`} data-bottom-nav>
      {onOpenMenu && (
        <button
          className={styles.navItem}
          onClick={onOpenMenu}
          aria-label="メニューを開く"
          style={{ fontSize: "20px" }}
        >
          <span className={styles.navIcon}>☰</span>
          <span className={styles.navLabel}>メニュー</span>
        </button>
      )}
      {actionButtons.map((button) => (
        <button
          key={button.id}
          className={styles.navItem}
          onClick={() => button.action?.()}
          disabled={button.disabled}
          aria-label={button.label}
          style={{ 
            fontSize: "16px",
            opacity: button.disabled ? 0.5 : 1,
            cursor: button.disabled ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "1",
            height: "100%",
            background: "transparent",
            border: "none",
            borderRadius: "8px",
            color: button.disabled ? "#666" : "#a1a1aa",
            transition: "all 0.2s ease",
            padding: "6px 4px",
            minWidth: "44px",
            minHeight: "44px",
            position: "relative",
            gap: "2px"
          }}
        >
          <span style={{
            fontSize: "22px",
            lineHeight: "1",
            marginBottom: "1px"
          }}>{button.icon}</span>
          <span style={{
            fontSize: "11px",
            fontWeight: "500",
            lineHeight: "1",
            textAlign: "center",
            letterSpacing: "0.02em"
          }}>{button.label}</span>
        </button>
      ))}
    </nav>
  );
}

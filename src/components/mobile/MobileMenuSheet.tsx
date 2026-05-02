import { useI18n } from "../../i18n/I18nContext";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenStageSettings: () => void;
  onOpenAddCue: () => void;
  onOpenExport: () => void;
  onOpenFlowLibrary: () => void;
  onOpenAudioImport: () => void;
  onOpenRosterImport: () => void;
  onOpenShareLinks: () => void;
  onOpenFormationBox: () => void;
  onOpenViewerMode: () => void;
  onAddDancer: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEnterZen: () => void;
  onOpenCueList: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isViewMode: boolean;
  hasServerId: boolean;
  isLoggedIn: boolean;
}

export function MobileMenuSheet(props: MobileMenuSheetProps) {
  const { t } = useI18n();

  if (!props.open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: "100%",
          background: "#13161C",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          borderBottomLeftRadius: "0px",
          borderBottomRightRadius: "0px",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          maxHeight: "80vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 12px",
            borderBottom: "0.5px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "#F0F2F8",
            }}
          >
            メニュー
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              color: "#F0F2F8",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Button Grid */}
        <div
          style={{
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
          }}
        >
          {/* Row 1: キュー設定 / 舞台設定 / 立ち位置保存 */}
          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onOpenAddCue}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5" />
            </svg>
            キュー設定
          </button>

          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onOpenStageSettings}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 15h6" />
            </svg>
            舞台設定
          </button>

          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onOpenFormationBox}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            立ち位置保存
          </button>

          {/* Row 2: キュー一覧 / +メンバー / ライブラリ */}
          <button
            type="button"
            onClick={props.onOpenCueList}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11H3m6 0v6m0-6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6m0 0v6a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-6m8 0h6m-6 0v6" />
            </svg>
            キュー一覧
          </button>

          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onAddDancer}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            +メンバー
          </button>

          <button
            type="button"
            onClick={props.onOpenFlowLibrary}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            ライブラリ
          </button>

          {/* Row 3: 音源取込 / 名簿取込 / 拡大 */}
          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onOpenAudioImport}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            音源取込
          </button>

          <button
            type="button"
            disabled={props.isViewMode}
            onClick={props.onOpenRosterImport}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: props.isViewMode ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: props.isViewMode ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: props.isViewMode ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8" />
            </svg>
            名簿取込
          </button>

          <button
            type="button"
            onClick={props.onEnterZen}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            拡大
          </button>

          {/* Row 4: メンバー表示 / 共有URL / クラウド保存 */}
          <button
            type="button"
            onClick={props.onOpenViewerMode}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            メンバー表示
          </button>

          <button
            type="button"
            onClick={props.onOpenShareLinks}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v10" />
            </svg>
            共有URL
          </button>

          <button
            type="button"
            disabled={!props.isLoggedIn || props.isViewMode}
            onClick={() => {
              // Cloud save logic would be passed as a prop
              if (props.isLoggedIn && !props.isViewMode) {
                // This would need to be implemented in the parent
                console.log("Cloud save requested");
              }
            }}
            style={{
              height: "72px",
              borderRadius: "12px",
              background: (!props.isLoggedIn || props.isViewMode) ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: (!props.isLoggedIn || props.isViewMode) ? "#64748B" : "#F0F2F8",
              flexDirection: "column",
              gap: "6px",
              cursor: (!props.isLoggedIn || props.isViewMode) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
            </svg>
            クラウド保存
          </button>
        </div>

        {/* Undo/Redo Row */}
        <div
          style={{
            padding: "0 20px 16px",
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            type="button"
            disabled={!props.canUndo || props.isViewMode}
            onClick={props.onUndo}
            style={{
              flex: 1,
              height: "48px",
              borderRadius: "12px",
              background: (!props.canUndo || props.isViewMode) ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "14px",
              color: (!props.canUndo || props.isViewMode) ? "#64748B" : "#F0F2F8",
              cursor: (!props.canUndo || props.isViewMode) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
            戻る
          </button>

          <button
            type="button"
            disabled={!props.canRedo || props.isViewMode}
            onClick={props.onRedo}
            style={{
              flex: 1,
              height: "48px",
              borderRadius: "12px",
              background: (!props.canRedo || props.isViewMode) ? "#0F172A" : "#1C202A",
              border: "0.5px solid rgba(255,255,255,0.1)",
              fontSize: "14px",
              color: (!props.canRedo || props.isViewMode) ? "#64748B" : "#F0F2F8",
              cursor: (!props.canRedo || props.isViewMode) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            進める
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

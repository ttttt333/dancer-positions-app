import { useState, useCallback } from 'react'
import { 
  Play,
  Settings,
  Save,
  Type,
  Maximize2,
  Eye,
  Grid3x3,
  List,
  Music,
  Library,
  UserPlus,
  Users,
  Share2,
  Cloud,
  Download,
  HelpCircle,
  Package
} from 'lucide-react'

interface Props {
  onOpenExport: () => void
  onOpenAddCue: () => void
  onOpenShortcutsHelp: () => void
  onOpenSetPiece: () => void
  onOpenStageShape: () => void
  onToggleSnapGrid: () => void
  jumpToPagerSlot: (n: number) => void
  snapGridEnabled?: boolean
}

// ボタンコンポーネント
function MenuButton({ 
  icon: Icon, 
  label, 
  onClick, 
  disabled = false, 
  color = "#8b5cf6",
  category = "stage"
}: { 
  icon: any; 
  label: string; 
  onClick: () => void; 
  disabled?: boolean; 
  color?: string;
  category?: "stage" | "cue" | "member" | "share";
}) {
  const categoryColors = {
    stage: "#8b5cf6", // パープル/ブルー系
    cue: "#f97316",    // オレンジ/レッド系
    member: "#10b981",  // ミント/グリーン系
    share: "#3b82f6",   // ブルー系
    default: "#8b5cf6"
  };
  
  const buttonColor = categoryColors[category] || color;
  
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: "80px",
        borderRadius: "16px",
        background: disabled 
          ? "rgba(255, 255, 255, 0.02)" 
          : "rgba(255, 255, 255, 0.05)",
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : `${buttonColor}30`}`,
        backdropFilter: "blur(10px)",
        fontSize: "11px",
        color: disabled ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)",
        flexDirection: "column",
        gap: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden"
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.borderColor = `${buttonColor}50`;
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          e.currentTarget.style.borderColor = `${buttonColor}30`;
          e.currentTarget.style.transform = "translateY(0px)";
        }
      }}
    >
      <Icon 
        size={24} 
        strokeWidth={1.5}
        style={{ 
          color: disabled ? "rgba(255,255,255,0.3)" : buttonColor,
          filter: `drop-shadow(0 0 8px ${disabled ? 'transparent' : buttonColor})`,
          transition: "all 0.2s ease"
        }} 
      />
      <span style={{ fontSize: "10px", opacity: disabled ? 0.5 : 0.8, fontWeight: 500 }}>
        {label}
      </span>
    </button>
  );
}

// セクションヘッダーコンポーネント
const SectionHeader = ({ title }: { title: string }) => (
  <div 
    style={{
      fontSize: "11px",
      fontWeight: 600,
      color: "rgba(255,255,255,0.4)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginBottom: "8px",
      marginLeft: "16px"
    }}
  >
    {title}
  </div>
);

// グリッド吸着トグルコンポーネント
const GridSnapToggle = ({ onToggle, enabled }: { onToggle: () => void, enabled: boolean }) => {
  return (
    <div 
      style={{
        height: "60px",
        borderRadius: "16px",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid #8b5cf630",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        margin: "0 16px",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.borderColor = "#8b5cf650";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        e.currentTarget.style.borderColor = "#8b5cf630";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Grid3x3 
          size={20} 
          strokeWidth={1.5}
          style={{ 
            color: "#8b5cf6",
            filter: "drop-shadow(0 0 8px #8b5cf6)"
          }} 
        />
        <span style={{ 
          fontSize: "13px", 
          color: "rgba(255,255,255,0.9)",
          fontWeight: 500
        }}>
          グリッド吸着
        </span>
      </div>
      
      {/* iOSスタイルトグル */}
      <div 
        style={{
          width: "51px",
          height: "31px",
          borderRadius: "31px",
          background: enabled ? "#8b5cf6" : "rgba(255,255,255,0.2)",
          position: "relative",
          transition: "all 0.3s ease",
          boxShadow: enabled ? "0 0 20px rgba(139, 92, 246, 0.5)" : "none"
        }}
      >
        <div 
          style={{
            width: "27px",
            height: "27px",
            borderRadius: "50%",
            background: "white",
            position: "absolute",
            top: "2px",
            left: enabled ? "22px" : "2px",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}
        />
      </div>
    </div>
  );
};

export function MobileBottomSheet({
  onOpenExport, onOpenAddCue, onOpenShortcutsHelp,
  onOpenSetPiece, onOpenStageShape, onToggleSnapGrid, jumpToPagerSlot,
  snapGridEnabled = false
}: Props) {
  const [open, setOpen] = useState(false)
  
  const go = useCallback((fn: () => void) => {
    fn()
    setOpen(false)
  }, [])

  return (
    <>
      {/* FABボタン */}
      <button 
        onClick={() => setOpen(v => !v)} 
        style={{
          position: 'fixed',
          bottom: 'calc(25% + 20px + env(safe-area-inset-bottom, 0px))',
          left: 20, 
          width: 56, 
          height: 56, 
          borderRadius: '50%',
          background: open 
            ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
            : 'linear-gradient(135deg, #4f46e5, #4338ca)',
          border: '2px solid rgba(255,255,255,0.15)',
          color: '#fff', 
          fontSize: 22, 
          cursor: 'pointer', 
          zIndex: 200,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: open 
            ? '0 4px 20px rgba(239, 68, 68, 0.4)' 
            : '0 4px 20px rgba(79, 70, 229, 0.4)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          WebkitTapHighlightColor: 'transparent',
          transform: open ? 'rotate(45deg) scale(1.1)' : 'rotate(0deg) scale(1)',
        }}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* オーバーレイ */}
      {open && (
        <div 
          onClick={() => setOpen(false)} 
          style={{
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0, 0, 0, 0.8)', 
            zIndex: 190,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out',
          }} 
        />
      )}

      {/* ボトムシート */}
      <div style={{
        position: 'fixed', 
        left: 0, 
        right: 0,
        bottom: 'calc(25% + env(safe-area-inset-bottom, 0px))',
        background: '#0F111A',
        borderRadius: '24px 24px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 195, 
        maxHeight: '85vh', 
        overflowY: 'auto',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none'
      }}>
        {/* ドラッグハンドル */}
        <div style={{ 
          width: 40, 
          height: 4, 
          background: 'rgba(255,255,255,0.2)', 
          borderRadius: 2, 
          margin: '12px auto 8px',
          opacity: 0.8
        }} />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#F0F2F8',
              letterSpacing: '-0.02em'
            }}
          >
            メニュー
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#F0F2F8',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 16px' }}>
          {/* 舞台・編集セクション */}
          <SectionHeader title="舞台・編集" />
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px',
              padding: '0 8px'
            }}
          >
            <MenuButton 
              icon={Play} 
              label="キュー設定" 
              onClick={() => go(onOpenAddCue)}
              category="stage"
            />
            <MenuButton 
              icon={Settings} 
              label="舞台設定" 
              onClick={() => go(onOpenStageShape)}
              category="stage"
            />
            <MenuButton 
              icon={Save} 
              label="立ち位置保存" 
              onClick={() => go(onOpenSetPiece)}
              category="stage"
            />
            <MenuButton 
              icon={Type} 
              label="テキスト" 
              onClick={() => {}}
              category="stage"
            />
            <MenuButton 
              icon={Maximize2} 
              label="拡大" 
              onClick={() => {}}
              category="stage"
            />
            <MenuButton 
              icon={Eye} 
              label="閲覧" 
              onClick={() => {}}
              category="stage"
            />
          </div>

          {/* グリッド吸着トグル */}
          <GridSnapToggle 
            onToggle={() => { onToggleSnapGrid(); }} 
            enabled={snapGridEnabled} 
          />
          
          <div style={{ marginBottom: '20px' }} />

          {/* キューセクション */}
          <SectionHeader title="キュー" />
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px',
              padding: '0 8px'
            }}
          >
            <MenuButton 
              icon={List} 
              label="キュー一覧" 
              onClick={() => {}}
              category="cue"
            />
            <MenuButton 
              icon={Music} 
              label="音源取込" 
              onClick={() => {}}
              category="cue"
            />
            <MenuButton 
              icon={Library} 
              label="ライブラリ" 
              onClick={() => {}}
              category="cue"
            />
          </div>

          {/* メンバーセクション */}
          <SectionHeader title="メンバー" />
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px',
              padding: '0 8px'
            }}
          >
            <MenuButton 
              icon={UserPlus} 
              label="+メンバー" 
              onClick={() => {}}
              category="member"
            />
            <MenuButton 
              icon={Download} 
              label="名簿取込" 
              onClick={() => {}}
              category="member"
            />
            <MenuButton 
              icon={Users} 
              label="メンバー表示" 
              onClick={() => {}}
              category="member"
            />
          </div>

          {/* 共有・出力セクション */}
          <SectionHeader title="共有・出力" />
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '20px',
              padding: '0 8px'
            }}
          >
            <MenuButton 
              icon={Share2} 
              label="共有URL" 
              onClick={() => {}}
              category="share"
            />
            <MenuButton 
              icon={Cloud} 
              label="クラウド保存" 
              onClick={() => {}}
              category="share"
            />
            <MenuButton 
              icon={Download} 
              label="書き出し" 
              onClick={() => go(onOpenExport)}
              category="share"
            />
            <MenuButton 
              icon={Package} 
              label="エクスポート" 
              onClick={() => {}}
              category="share"
            />
            <MenuButton 
              icon={HelpCircle} 
              label="ヘルプ" 
              onClick={() => go(onOpenShortcutsHelp)}
              category="share"
            />
            <MenuButton 
              icon={Package} 
              label="大道具" 
              onClick={() => go(onOpenSetPiece)}
              category="share"
            />
          </div>

          {/* ページ移動 */}
          <div 
            style={{
              padding: '0 8px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => { jumpToPagerSlot(-1); }}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #8b5cf630',
                backdropFilter: 'blur(10px)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              前のページ
            </button>

            <button
              type="button"
              onClick={() => { jumpToPagerSlot(1); }}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #8b5cf630',
                backdropFilter: 'blur(10px)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              次のページ
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// src/components/mobile/MobileHeader.tsx

interface MobileHeaderProps {
  projectName: string;
  currentIndex: number;
  totalCues: number;
  isPlaying: boolean;
}

export function MobileHeader({
  projectName,
  currentIndex,
  totalCues,
  isPlaying,
}: MobileHeaderProps) {
  return (
    <div style={{
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      background: "#13161C",
      borderBottom: "0.5px solid rgba(255,255,255,0.08)",
      flexShrink: 0,
      WebkitAppRegion: "drag",
    } as React.CSSProperties}>

      {/* 左：プロジェクト名 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#F0F2F8",
        }}>
          Choreo<span style={{ color: "#6C63FF" }}>Core</span>
        </span>
        <span style={{
          fontSize: 12,
          color: "#555B6A",
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {projectName}
        </span>
      </div>

      {/* 右：シーン番号 + 状態 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* 再生状態インジケーター */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontFamily: "monospace",
          color: isPlaying ? "#10B981" : "#555B6A",
          background: isPlaying ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
          border: `0.5px solid ${isPlaying ? "#10B981" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 99,
          padding: "3px 8px",
          transition: "all 0.2s",
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isPlaying ? "#10B981" : "#555B6A",
            display: "inline-block",
          }} />
          {isPlaying ? "再生中" : "停止"}
        </div>

        {/* シーン番号 */}
        {totalCues > 0 && (
          <div style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "#8B909E",
            background: "rgba(255,255,255,0.05)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "3px 8px",
          }}>
            {currentIndex + 1} / {totalCues}
          </div>
        )}
      </div>
    </div>
  );
}

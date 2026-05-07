import React from 'react';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';
import type { Formation, Position } from '../../types';
import styles from './MobileStageCanvas.module.css';

export const MobileStageCanvas: React.FC = () => {
  const { project } = useProject();
  const { currentTime } = useUIStore();

  // 現在時刻のフォーメーションを取得
  const currentFormation = React.useMemo(() => {
    if (!project) return null;
    
    const formations = project.formations.filter((f: Formation) => 
      f.timestamp <= currentTime && (!f.duration || f.timestamp + f.duration >= currentTime)
    );
    
    if (formations.length === 0) return null;
    
    return formations.reduce((nearest: Formation, current: Formation) => 
      Math.abs(current.timestamp - currentTime) < Math.abs(nearest.timestamp - currentTime) ? current : nearest
    );
  }, [project?.formations, currentTime]); // 依存配列を修正

  return (
    <div className={styles.mobileStageCanvas}>
      {/* グリッド */}
      <svg className={styles.gridOverlay}>
        <defs>
          <pattern id="mobileGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mobileGrid)" />
        
        {/* センターライン */}
        <line x1="50%" y1="0" x2="50%" y2="100%" 
          stroke="rgba(108,99,255,0.2)" strokeWidth="1" strokeDasharray="4 4"/>
        
        {/* ステージ前ライン */}
        <line x1="5%" y1="90%" x2="95%" y2="90%" 
          stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      </svg>

      {/* ダンサーマーカー */}
      {currentFormation?.positions.map((position: Position) => {
        const dancer = project?.dancers.find((d: any) => d.id === position.dancerId);
        if (!dancer) return null;

        // CSS変数を使用してスタイルを適用
        const dancerStyle = {
          '--left': `${position.x * 50 + 50}%`,
          '--top': `${position.y * 50 + 50}%`,
          '--bg-color': dancer.color,
        } as React.CSSProperties;

        return (
          <div
            key={position.dancerId}
            className={styles.dancerMarker}
            style={dancerStyle}
          >
            <span className={styles.dancerLabel}>
              {dancer.name.charAt(0)}
            </span>
          </div>
        );
      })}

      {/* 客席インジケーター */}
      <div className={styles.audienceIndicator}>
        客席
      </div>
    </div>
  );
};

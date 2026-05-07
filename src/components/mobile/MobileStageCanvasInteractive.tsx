import React, { useRef, useState, useCallback } from 'react';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';
import type { Formation, Position } from '../../types';
import styles from './MobileStageCanvas.module.css';

export const MobileStageCanvas: React.FC = () => {
  const { project } = useProject();
  const { currentTime } = useUIStore();
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggedDancer, setDraggedDancer] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
  }, [project?.formations, currentTime]);

  // タッチ開始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    const dancerElement = target.closest('[data-dancer-id]');
    
    if (dancerElement && stageRef.current) {
      const dancerId = dancerElement.getAttribute('data-dancer-id');
      if (dancerId) {
        setDraggedDancer(dancerId);
        
        const rect = stageRef.current.getBoundingClientRect();
        const dancerEl = dancerElement as HTMLElement;
        const dancerRect = dancerEl.getBoundingClientRect();
        
        setDragOffset({
          x: touch.clientX - dancerRect.left - dancerRect.width / 2,
          y: touch.clientY - dancerRect.top - dancerRect.height / 2,
        });
        
        // バイブレーションフィードバック
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    }
  }, []);

  // タッチ移動
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggedDancer || !stageRef.current) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const rect = stageRef.current.getBoundingClientRect();
    
    // ステージ座標に変換 (-1 から 1 の範囲)
    const x = ((touch.clientX - rect.left - dragOffset.x) / rect.width - 0.5) * 2;
    const y = ((touch.clientY - rect.top - dragOffset.y) / rect.height - 0.5) * 2;
    
    // 範囲内にクランプ
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    
    // ここでダンサーの位置を更新するロジックを実装
    console.log('Dancer position:', draggedDancer, clampedX, clampedY);
  }, [draggedDancer, dragOffset]);

  // タッチ終了
  const handleTouchEnd = useCallback(() => {
    if (draggedDancer) {
      setDraggedDancer(null);
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  }, [draggedDancer]);

  return (
    <div 
      ref={stageRef}
      className={styles.mobileStageCanvas}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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

        const dancerStyle = {
          '--left': `${position.x * 50 + 50}%`,
          '--top': `${position.y * 50 + 50}%`,
          '--bg-color': dancer.color,
        } as React.CSSProperties;

        return (
          <div
            key={position.dancerId}
            data-dancer-id={position.dancerId}
            className={`${styles.dancerMarker} ${draggedDancer === position.dancerId ? styles.dragging : ''}`}
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

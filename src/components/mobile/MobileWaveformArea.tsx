import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import styles from './MobileWaveformArea.module.css';

export const MobileWaveformArea: React.FC = () => {
  const { isPlaying, currentTime, setIsPlaying } = useUIStore();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.mobileWaveformArea}>
      {/* 波形プレースホルダー */}
      <div className={styles.waveformContainer}>
        <svg className={styles.waveformSvg} viewBox="0 0 1000 100">
          {/* 簡易的な波形表示 */}
          <path
            d="M0,50 Q50,30 100,50 T200,50 T300,50 T400,50 T500,50 T600,50 T700,50 T800,50 T900,50 T1000,50"
            fill="none"
            stroke="rgba(108,99,255,0.6)"
            strokeWidth="2"
          />
          
          {/* 再生位置インジケーター */}
          <line
            x1={`${(currentTime / 180) * 1000}`} // 3分 = 180秒を基準
            y1="0"
            x2={`${(currentTime / 180) * 1000}`}
            y2="100"
            stroke="#ff6b6b"
            strokeWidth="2"
          />
        </svg>
        
        {/* キュー（フォーメーション）インジケーター */}
        <div className={styles.cueIndicators}>
          <div className={styles.cueMarker} style={{ left: '20%' }} />
          <div className={`${styles.cueMarker} ${styles.active}`} style={{ left: '40%' }} />
          <div className={styles.cueMarker} style={{ left: '60%' }} />
          <div className={styles.cueMarker} style={{ left: '80%' }} />
        </div>
      </div>

      {/* 再生コントロール */}
      <div className={styles.playbackControls}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        <div className={styles.timeDisplay}>
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
};

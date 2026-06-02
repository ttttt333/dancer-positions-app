/**
 * LandscapeBottomWaveBar.tsx
 * 横画面: 画面下部に波形・タイムラインのみ表示（操作は左パネル）
 */

import React from "react";
import styles from "./LandscapeBottomWaveBar.module.css";
import {
  PortraitWaveTransport,
  type PortraitWaveTransportHandle,
} from "./PortraitWaveTransport";
import { LANDSCAPE_WAVE_CANVAS_HEIGHT_PX } from "./landscapeWaveLayout";

interface Props {
  waveRef: React.RefObject<PortraitWaveTransportHandle | null>;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onCollapse: () => void;
}

export const LandscapeBottomWaveBar: React.FC<Props> = ({
  waveRef,
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
  onCollapse,
}) => {
  return (
    <div className={styles.dock}>
      <PortraitWaveTransport
        ref={waveRef}
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onStop={onStop}
        onSeek={onSeek}
        showTransportControls={false}
        waveHeightPx={LANDSCAPE_WAVE_CANVAS_HEIGHT_PX}
        onCollapseWave={onCollapse}
        compactLandscape
      />
    </div>
  );
};

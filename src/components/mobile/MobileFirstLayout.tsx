import { useState } from 'react';
import { MobileStageCanvas } from './MobileStageCanvasInteractive';
import { MobileWaveformArea } from './MobileWaveformArea';
import { SimpleFAB } from './SimpleFAB';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';
import styles from './MobileFirstLayout.module.css';

export const MobileFirstLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { project } = useProject();
  const { isPlaying, currentTime } = useUIStore();

  return (
    <div className={styles.mobileFirstLayout}>
      {/* メインステージ (70%) */}
      <div className={styles.stageArea}>
        <MobileStageCanvas />
      </div>

      {/* 波形・キューエリア (25%) */}
      <div className={styles.waveformArea}>
        <MobileWaveformArea />
      </div>

      {/* 格納式メニューボタン (5%) */}
      <div className={styles.fabArea}>
        <SimpleFAB 
          isOpen={isMenuOpen}
          onToggle={() => setIsMenuOpen(!isMenuOpen)}
        />
      </div>
    </div>
  );
};

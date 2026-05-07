import React, { useEffect } from 'react';
import { MobileFirstLayout } from '../components/mobile/MobileFirstLayout';
import { useProject } from '../features/project/hooks';
import { useUIStore } from '../store/useUIStore';
import styles from './MobilePurePage.module.css';

export const MobilePurePage: React.FC = () => {
  const { project, createProject, addDancer } = useProject();
  const { setIsPlaying } = useUIStore();

  // 初期データセットアップ
  useEffect(() => {
    if (!project) {
      // テストプロジェクト作成
      const newProject = createProject('ChoreoCore Mobile');
      if (newProject) {
        // テストダンサー追加
        addDancer({ name: 'A', color: '#ff6b6b' });
        addDancer({ name: 'B', color: '#4ecdc4' });
        addDancer({ name: 'C', color: '#45b7d1' });
        addDancer({ name: 'D', color: '#f9ca24' });
      }
    }
  }, [project, createProject, addDancer]);

  // 自動再生開始（モバイル体験向上）
  useEffect(() => {
    if (project && project.dancers.length > 0) {
      setTimeout(() => {
        setIsPlaying(true);
      }, 1500);
    }
  }, [project, setIsPlaying]);

  if (!project) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.spinner} />
          <div>ChoreoCore</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mobilePurePage}>
      <MobileFirstLayout />
    </div>
  );
};

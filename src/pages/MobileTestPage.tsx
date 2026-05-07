import React, { useEffect } from 'react';
import { MobileFirstLayout } from '../components/mobile/MobileFirstLayout';
import { useProject } from '../features/project/hooks';
import { useUIStore } from '../store/useUIStore';

export const MobileTestPage: React.FC = () => {
  const { project, createProject, addDancer } = useProject();
  const { selectedDancerIds, setSelectedDancerIds } = useUIStore();

  // 初期データセットアップ
  useEffect(() => {
    if (!project) {
      // テストプロジェクト作成
      const newProject = createProject('モバイルテストプロジェクト');
      if (newProject) {
        // テストダンサー追加
        addDancer({ name: '山田', color: '#ff6b6b' });
        addDancer({ name: '鈴木', color: '#4ecdc4' });
        addDancer({ name: '佐木', color: '#45b7d1' });
        addDancer({ name: '田中', color: '#f9ca24' });
        
        // サンプルフォーメーション追加
        setTimeout(() => {
          setSelectedDancerIds(['1', '2', '3', '4']); // 仮のID
        }, 1000);
      }
    }
  }, [project, createProject, addDancer, setSelectedDancerIds]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div>モバイル版初期化中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-test-page">
      <MobileFirstLayout />
      
      {/* デバッグ情報（開発時のみ表示） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <div>プロジェクト: {project.name}</div>
          <div>ダンサー数: {project.dancers.length}</div>
          <div>フォーメーション数: {project.formations.length}</div>
        </div>
      )}

      <style jsx>{`
        .mobile-test-page {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }

        .debug-info {
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          z-index: 9999;
          pointer-events: none;
        }

        @media (orientation: landscape) {
          .debug-info {
            top: auto;
            bottom: 10px;
            right: 10px;
          }
        }
      `}</style>
    </div>
  );
};

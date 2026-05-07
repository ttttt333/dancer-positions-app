import React, { useEffect } from 'react';
import { TopBar } from '../components/editor/TopBar';
import { BottomBar } from '../components/editor/BottomBar';
import { StageCanvas } from '../components/stage/StageCanvas';
import { Button } from '../components/ui/Button';
import { useProject } from '../features/project/hooks';
import { useUIStore } from '../store/useUIStore';
import { analytics, ANALYTICS_EVENTS } from '../lib/analytics';

export const TestEditorPage: React.FC = () => {
  const { project, createProject, addDancer } = useProject();
  const { selectedDancerIds, setSelectedDancerIds } = useUIStore();

  // 初期データセットアップ
  useEffect(() => {
    if (!project) {
      // テストプロジェクト作成
      const newProject = createProject('テストプロジェクト');
      if (newProject) {
        // テストダンサー追加
        addDancer({ name: '山田太郎', color: '#ff6b6b' });
        addDancer({ name: '鈴木花子', color: '#4ecdc4' });
        addDancer({ name: '佐木次郎', color: '#45b7d1' });
        addDancer({ name: '田中梅子', color: '#f9ca24' });
      }
    }
  }, [project, createProject, addDancer]);

  const handleDancerSelect = (dancerId: string) => {
    if (selectedDancerIds.includes(dancerId)) {
      setSelectedDancerIds(selectedDancerIds.filter(id => id !== dancerId));
    } else {
      setSelectedDancerIds([...selectedDancerIds, dancerId]);
    }
  };

  const handleSelectAll = () => {
    if (!project) return;
    const allDancerIds = project.dancers.map(d => d.id);
    setSelectedDancerIds(allDancerIds);
  };

  const handleClearSelection = () => {
    setSelectedDancerIds([]);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>初期化中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <TopBar />
      
      <div className="flex-1 flex">
        {/* サイドバー - ダンサーリスト */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-4">ダンサー一覧</h3>
          
          <div className="space-y-2 mb-4">
            <Button variant="secondary" size="sm" onClick={handleSelectAll}>
              すべて選択
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClearSelection}>
              選択解除
            </Button>
          </div>
          
          <div className="space-y-2">
            {project.dancers.map((dancer) => (
              <div
                key={dancer.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDancerIds.includes(dancer.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleDancerSelect(dancer.id)}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: dancer.color }}
                  />
                  <span className="text-sm font-medium">{dancer.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* メインエリア - ステージ */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-8">
            <StageCanvas
              width={800}
              height={600}
              className="mx-auto"
            />
          </div>
          
          <BottomBar />
        </div>
      </div>
    </div>
  );
};

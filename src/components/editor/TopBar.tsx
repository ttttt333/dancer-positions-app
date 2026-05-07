import React from 'react';
import { Button } from '../ui/Button';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';

export const TopBar: React.FC = () => {
  const { project } = useProject();
  const { isPlaying, setIsPlaying, currentTime } = useUIStore();

  const handleSave = async () => {
    if (!project) return;
    // 保存ロジックを実装
    console.log('Saving project:', project.name);
  };

  const handleShare = async () => {
    if (!project) return;
    // 共有ロジックを実装
    console.log('Sharing project:', project.name);
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold text-gray-900">
          {project?.name || '無題プロジェクト'}
        </h1>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={isPlaying ? 'danger' : 'primary'}
            size="sm"
            onClick={togglePlayback}
          >
            {isPlaying ? '停止' : '再生'}
          </Button>
          
          <span className="text-sm text-gray-600">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="secondary" size="sm" onClick={handleSave}>
          保存
        </Button>
        
        <Button variant="primary" size="sm" onClick={handleShare}>
          共有
        </Button>
      </div>
    </div>
  );
};

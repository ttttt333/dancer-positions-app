import React from 'react';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';
import type { Formation, Position } from '../../types';

interface StageCanvasProps {
  width: number;
  height: number;
  className?: string;
}

export const StageCanvas: React.FC<StageCanvasProps> = ({ 
  width, 
  height, 
  className = '' 
}) => {
  const { project } = useProject();
  const { selectedFormationId, currentTime } = useUIStore();

  // 現在時刻のフォーメーションを取得
  const currentFormation = React.useMemo(() => {
    if (!project) return null;
    
    const formations = project.formations.filter(f => 
      f.timestamp <= currentTime && (!f.duration || f.timestamp + f.duration >= currentTime)
    );
    
    if (formations.length === 0) return null;
    
    return formations.reduce((nearest, current) => 
      Math.abs(current.timestamp - currentTime) < Math.abs(nearest.timestamp - currentTime) ? current : nearest
    );
  }, [project, currentTime]);

  const selectedFormation = React.useMemo(() => {
    if (!project || !selectedFormationId) return null;
    return project.formations.find(f => f.id === selectedFormationId) || null;
  }, [project, selectedFormationId]);

  const displayFormation = selectedFormation || currentFormation;

  return (
    <div 
      className={`relative bg-gray-50 border border-gray-300 ${className}`}
      style={{ width, height }}
    >
      {/* グリッド */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* 舞台枠 */}
      <div className="absolute inset-4 border-2 border-gray-600 rounded-lg" />

      {/* ダンサーマーカー */}
      {displayFormation?.positions.map((position) => {
        const dancer = project?.dancers.find(d => d.id === position.dancerId);
        if (!dancer) return null;

        return (
          <div
            key={position.dancerId}
            className="absolute w-8 h-8 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs font-medium transition-all duration-200"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              backgroundColor: dancer.color,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {dancer.name.charAt(0)}
          </div>
        );
      })}

      {/* 客席方向インジケーター */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
          客席
        </div>
      </div>
    </div>
  );
};

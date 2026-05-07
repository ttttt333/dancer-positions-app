import React from 'react';
import { Button } from '../ui/Button';
import { useFormation } from '../../features/formation/hooks';
import { useProject } from '../../features/project/hooks';
import { useUIStore } from '../../store/useUIStore';

export const BottomBar: React.FC = () => {
  const { project } = useProject();
  const { createCircleFormation, createLineFormation, createGridFormation } = useFormation();
  const { selectedDancerIds } = useUIStore();

  const handleCircleFormation = () => {
    if (!project || selectedDancerIds.length === 0) return;
    createCircleFormation(400, 300, 100, selectedDancerIds);
  };

  const handleLineFormation = () => {
    if (!project || selectedDancerIds.length === 0) return;
    createLineFormation(200, 300, 600, 300, selectedDancerIds);
  };

  const handleGridFormation = () => {
    if (!project || selectedDancerIds.length === 0) return;
    const cols = Math.ceil(Math.sqrt(selectedDancerIds.length));
    createGridFormation(250, 200, cols, 60, selectedDancerIds);
  };

  return (
    <div className="flex items-center justify-center px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700">
          整列パターン:
        </span>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCircleFormation}
          disabled={selectedDancerIds.length === 0}
        >
          円形
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLineFormation}
          disabled={selectedDancerIds.length === 0}
        >
          ライン
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGridFormation}
          disabled={selectedDancerIds.length === 0}
        >
          グリッド
        </Button>
        
        {selectedDancerIds.length === 0 && (
          <span className="text-xs text-gray-500">
            ダンサーを選択してください
          </span>
        )}
      </div>
    </div>
  );
};

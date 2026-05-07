import { useProjectStore } from '../../store/useProjectStore';
import { FormationModel } from './model';
import type { Formation, Position } from '../../types';

export function useFormation() {
  const { project, setProject } = useProjectStore();

  const createCircleFormation = (centerX: number, centerY: number, radius: number, dancerIds: string[]) => {
    if (!project) return null;
    
    const formation = FormationModel.createCircleFormation(centerX, centerY, radius, dancerIds);
    const updated = {
      ...project,
      formations: [...project.formations, formation],
      updatedAt: new Date(),
    };
    
    setProject(updated);
    return formation;
  };

  const createLineFormation = (startX: number, startY: number, endX: number, endY: number, dancerIds: string[]) => {
    if (!project) return null;
    
    const formation = FormationModel.createLineFormation(startX, startY, endX, endY, dancerIds);
    const updated = {
      ...project,
      formations: [...project.formations, formation],
      updatedAt: new Date(),
    };
    
    setProject(updated);
    return formation;
  };

  const createGridFormation = (startX: number, startY: number, cols: number, spacing: number, dancerIds: string[]) => {
    if (!project) return null;
    
    const formation = FormationModel.createGridFormation(startX, startY, cols, spacing, dancerIds);
    const updated = {
      ...project,
      formations: [...project.formations, formation],
      updatedAt: new Date(),
    };
    
    setProject(updated);
    return formation;
  };

  const updateFormationPositions = (formationId: string, positions: Position[]) => {
    if (!project) return null;
    
    const updated = {
      ...project,
      formations: project.formations.map(f =>
        f.id === formationId ? { ...f, positions } : f
      ),
      updatedAt: new Date(),
    };
    
    setProject(updated);
    return updated;
  };

  const getFormationById = (formationId: string): Formation | null => {
    if (!project) return null;
    return project.formations.find(f => f.id === formationId) || null;
  };

  return {
    createCircleFormation,
    createLineFormation,
    createGridFormation,
    updateFormationPositions,
    getFormationById,
  };
}

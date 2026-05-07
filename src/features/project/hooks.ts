import { useProjectStore } from '../../store/useProjectStore';
import { ProjectModel } from './model';
import type { Dancer, Formation } from '../../types';

export function useProject() {
  const { project, setProject } = useProjectStore();

  const createProject = (name: string) => {
    const newProject = ProjectModel.create(name);
    setProject(newProject);
    return newProject;
  };

  const addDancer = (dancer: Omit<Dancer, 'id'>) => {
    if (!project) return null;
    const updated = ProjectModel.addDancer(project, dancer);
    setProject(updated);
    return updated;
  };

  const removeDancer = (dancerId: string) => {
    if (!project) return null;
    const updated = ProjectModel.removeDancer(project, dancerId);
    setProject(updated);
    return updated;
  };

  const addFormation = (formation: Omit<Formation, 'id'>) => {
    if (!project) return null;
    const updated = ProjectModel.addFormation(project, formation);
    setProject(updated);
    return updated;
  };

  const updateFormation = (formationId: string, updates: Partial<Formation>) => {
    if (!project) return null;
    const updated = ProjectModel.updateFormation(project, formationId, updates);
    setProject(updated);
    return updated;
  };

  const removeFormation = (formationId: string) => {
    if (!project) return null;
    const updated = ProjectModel.removeFormation(project, formationId);
    setProject(updated);
    return updated;
  };

  const getFormationAtTime = (time: number) => {
    if (!project) return null;
    return ProjectModel.getFormationAtTime(project, time);
  };

  return {
    project,
    createProject,
    addDancer,
    removeDancer,
    addFormation,
    updateFormation,
    removeFormation,
    getFormationAtTime,
  };
}

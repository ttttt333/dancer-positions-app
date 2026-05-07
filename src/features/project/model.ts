import type { Project, Dancer, Formation } from '../../types';
import { generateUUID } from '../../lib/uuid';

export class ProjectModel {
  static create(name: string): Project {
    return {
      id: generateUUID(),
      name,
      dancers: [],
      formations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static addDancer(project: Project, dancer: Omit<Dancer, 'id'>): Project {
    const newDancer: Dancer = {
      ...dancer,
      id: generateUUID(),
    };
    
    return {
      ...project,
      dancers: [...project.dancers, newDancer],
      updatedAt: new Date(),
    };
  }

  static removeDancer(project: Project, dancerId: string): Project {
    return {
      ...project,
      dancers: project.dancers.filter(d => d.id !== dancerId),
      formations: project.formations.map(f => ({
        ...f,
        positions: f.positions.filter(p => p.dancerId !== dancerId),
      })),
      updatedAt: new Date(),
    };
  }

  static addFormation(project: Project, formation: Omit<Formation, 'id'>): Project {
    const newFormation: Formation = {
      ...formation,
      id: crypto.randomUUID(),
    };
    
    return {
      ...project,
      formations: [...project.formations, newFormation],
      updatedAt: new Date(),
    };
  }

  static updateFormation(project: Project, formationId: string, updates: Partial<Formation>): Project {
    return {
      ...project,
      formations: project.formations.map(f =>
        f.id === formationId ? { ...f, ...updates } : f
      ),
      updatedAt: new Date(),
    };
  }

  static removeFormation(project: Project, formationId: string): Project {
    return {
      ...project,
      formations: project.formations.filter(f => f.id !== formationId),
      updatedAt: new Date(),
    };
  }

  static getFormationAtTime(project: Project, time: number): Formation | null {
    // 指定時刻に最も近いフォーメーションを取得
    const formations = project.formations.filter(f => 
      f.timestamp <= time && (!f.duration || f.timestamp + f.duration >= time)
    );
    
    if (formations.length === 0) return null;
    
    // 最も近いものを返す
    return formations.reduce((nearest, current) => 
      Math.abs(current.timestamp - time) < Math.abs(nearest.timestamp - time) ? current : nearest
    );
  }
}

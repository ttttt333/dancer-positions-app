import type { Project } from '../../types';

export class ProjectService {
  private static baseUrl = '/api/project';

  static async create(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    
    return response.json();
  }

  static async get(projectId: string): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/${projectId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    
    return response.json();
  }

  static async update(projectId: string, updates: Partial<Project>): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update project');
    }
    
    return response.json();
  }

  static async delete(projectId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${projectId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  static async list(): Promise<Project[]> {
    const response = await fetch(this.baseUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    
    return response.json();
  }
}

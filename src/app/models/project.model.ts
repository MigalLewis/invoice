export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type CreateProject = Pick<Project, 'name' | 'description' | 'status'>;

export interface ProjectManifest {
  id: string;
  name: string;
  url: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export type ProjectFormData = Omit<ProjectManifest, 'id' | 'createdAt' | 'updatedAt'>;

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectManifest, ProjectFormData } from '../types';

const STORAGE_KEY = 'dopple-studio-projects';

function loadProjects(): ProjectManifest[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: ProjectManifest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectManifest[]>(() => loadProjects());

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const addProject = useCallback((data: ProjectFormData): ProjectManifest => {
    const now = Date.now();
    const newProject: ProjectManifest = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback((id: string, data: Partial<ProjectFormData>): void => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id
          ? { ...project, ...data, updatedAt: Date.now() }
          : project
      )
    );
  }, []);

  const deleteProject = useCallback((id: string): void => {
    setProjects((prev) => prev.filter((project) => project.id !== id));
  }, []);

  const getProject = useCallback(
    (id: string): ProjectManifest | undefined => {
      return projects.find((project) => project.id === id);
    },
    [projects]
  );

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    getProject,
  };
}

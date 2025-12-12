import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectManifest, ProjectFormData } from '../types';

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setProjects([]);
    } else {
      setProjects(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          url: row.url,
          icon: row.icon ?? undefined,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        }))
      );
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = useCallback(
    async (data: ProjectFormData): Promise<ProjectManifest | null> => {
      if (!user) return null;

      const { data: newProject, error: insertError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.name,
          url: data.url,
          icon: data.icon || null,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      const project: ProjectManifest = {
        id: newProject.id,
        name: newProject.name,
        url: newProject.url,
        icon: newProject.icon ?? undefined,
        createdAt: new Date(newProject.created_at).getTime(),
        updatedAt: new Date(newProject.updated_at).getTime(),
      };

      setProjects((prev) => [project, ...prev]);
      return project;
    },
    [user]
  );

  const updateProject = useCallback(
    async (id: string, data: Partial<ProjectFormData>): Promise<void> => {
      if (!user) return;

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          name: data.name,
          url: data.url,
          icon: data.icon || null,
        })
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === id
            ? { ...project, ...data, updatedAt: Date.now() }
            : project
        )
      );
    },
    [user]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;

      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setProjects((prev) => prev.filter((project) => project.id !== id));
    },
    [user]
  );

  const getProject = useCallback(
    (id: string): ProjectManifest | undefined => {
      return projects.find((project) => project.id === id);
    },
    [projects]
  );

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    getProject,
    refetch: fetchProjects,
  };
}

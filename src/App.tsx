import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useProjects } from './hooks/useProjects';
import { Gallery, ProjectForm, Auth } from './components';
import type { ProjectManifest, ProjectFormData } from './types';
import './App.css';

type View = 'gallery' | 'create' | 'edit';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { projects, loading: projectsLoading, addProject, updateProject, deleteProject } = useProjects();
  const [view, setView] = useState<View>('gallery');
  const [editingProject, setEditingProject] = useState<ProjectManifest | null>(null);

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleCreate = () => {
    setEditingProject(null);
    setView('create');
  };

  const handleEdit = (project: ProjectManifest) => {
    setEditingProject(project);
    setView('edit');
  };

  const handleFormSubmit = async (data: ProjectFormData) => {
    if (view === 'edit' && editingProject) {
      await updateProject(editingProject.id, data);
    } else {
      await addProject(data);
    }
    setView('gallery');
    setEditingProject(null);
  };

  const handleCancel = () => {
    setView('gallery');
    setEditingProject(null);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-section" onClick={() => setView('gallery')}>
          <img src="/dopple_logo.webp" alt="Dopple" className="logo" />
        </div>
        <div className="header-actions">
          {view === 'gallery' && projects.length > 0 && (
            <button className="btn-header-create" onClick={handleCreate}>
              + New Project
            </button>
          )}
          <button className="btn-sign-out" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-main">
        {projectsLoading ? (
          <div className="projects-loading">
            <div className="loading-spinner"></div>
            <p>Loading projects...</p>
          </div>
        ) : view === 'gallery' ? (
          <Gallery
            projects={projects}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateNew={handleCreate}
          />
        ) : (
          <ProjectForm
            project={editingProject || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Dopple Studio - Create and manage your project QR codes</p>
      </footer>
    </div>
  );
}

export default App;

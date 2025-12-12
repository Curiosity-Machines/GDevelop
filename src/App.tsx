import { useState } from 'react';
import { useProjects } from './hooks/useProjects';
import { Gallery, ProjectForm } from './components';
import type { ProjectManifest, ProjectFormData } from './types';
import './App.css';

type View = 'gallery' | 'create' | 'edit';

function App() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const [view, setView] = useState<View>('gallery');
  const [editingProject, setEditingProject] = useState<ProjectManifest | null>(null);

  const handleCreate = () => {
    setEditingProject(null);
    setView('create');
  };

  const handleEdit = (project: ProjectManifest) => {
    setEditingProject(project);
    setView('edit');
  };

  const handleFormSubmit = (data: ProjectFormData) => {
    if (view === 'edit' && editingProject) {
      updateProject(editingProject.id, data);
    } else {
      addProject(data);
    }
    setView('gallery');
    setEditingProject(null);
  };

  const handleCancel = () => {
    setView('gallery');
    setEditingProject(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-section" onClick={() => setView('gallery')}>
          <div className="logo">D</div>
          <h1>Dopple Studio</h1>
        </div>
        {view === 'gallery' && projects.length > 0 && (
          <button className="btn-header-create" onClick={handleCreate}>
            + New Project
          </button>
        )}
      </header>

      <main className="app-main">
        {view === 'gallery' ? (
          <Gallery
            projects={projects}
            onEdit={handleEdit}
            onDelete={deleteProject}
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

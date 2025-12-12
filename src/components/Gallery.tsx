import { useState } from 'react';
import type { ProjectManifest } from '../types';
import { ProjectCard } from './ProjectCard';
import './Gallery.css';

interface GalleryProps {
  projects: ProjectManifest[];
  onEdit: (project: ProjectManifest) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
}

export function Gallery({ projects, onEdit, onDelete, onCreateNew }: GalleryProps) {
  const [focusedProject, setFocusedProject] = useState<ProjectManifest | null>(null);

  if (projects.length === 0) {
    return (
      <div className="gallery-empty">
        <div className="empty-icon">📱</div>
        <h2>No Projects Yet</h2>
        <p>Create your first project to generate QR codes</p>
        <button className="btn-create" onClick={onCreateNew}>
          Create Project
        </button>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2>Your Projects</h2>
        <span className="project-count">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className={`gallery-grid ${focusedProject ? 'blurred' : ''}`}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={() => setFocusedProject(project)}
          />
        ))}
      </div>

      {focusedProject && (
        <div className="gallery-overlay" onClick={() => setFocusedProject(null)}>
          <div className="focused-card-container" onClick={(e) => e.stopPropagation()}>
            <ProjectCard
              project={focusedProject}
              onEdit={(p) => {
                setFocusedProject(null);
                onEdit(p);
              }}
              onDelete={(id) => {
                setFocusedProject(null);
                onDelete(id);
              }}
              isFocused={true}
            />
            <button className="btn-close-focus" onClick={() => setFocusedProject(null)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { ProjectManifest } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import './ProjectCard.css';

interface ProjectCardProps {
  project: ProjectManifest;
  onEdit: (project: ProjectManifest) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
  isFocused?: boolean;
}

export function ProjectCard({ project, onEdit, onDelete, onClick, isFocused = false }: ProjectCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(project.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(project);
  };

  return (
    <div 
      className={`project-card ${isFocused ? 'focused' : ''}`}
      onClick={onClick}
    >
      <div
        className="card-background"
        style={project.icon ? { backgroundImage: `url(${project.icon})` } : undefined}
      >
        <div className="card-background-overlay" />
        <div className="card-header">
          <h3>{project.name}</h3>
          <a 
            href={project.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="project-url"
            onClick={(e) => e.stopPropagation()}
          >
            {project.url}
          </a>
        </div>
      </div>

      <div className="card-qr-section">
        <QRCodeDisplay 
          project={project} 
          size={isFocused ? 300 : 200} 
          showDetails={isFocused} 
        />
      </div>

      <div className="card-actions">
        <button className="btn-edit" onClick={handleEdit}>
          Edit
        </button>
        <button
          className={`btn-delete ${confirmDelete ? 'confirm' : ''}`}
          onClick={handleDelete}
        >
          {confirmDelete ? 'Confirm Delete?' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

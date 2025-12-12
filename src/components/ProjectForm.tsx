import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { ProjectManifest, ProjectFormData } from '../types';
import './ProjectForm.css';

interface ProjectFormProps {
  project?: ProjectManifest;
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setUrl(project.url);
      setIcon(project.icon || '');
    }
  }, [project]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    onSubmit({
      name: name.trim(),
      url: url.trim(),
      icon: icon.trim() || undefined,
    });

    if (!project) {
      setName('');
      setUrl('');
      setIcon('');
    }
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <h2>{project ? 'Edit Project' : 'Create New Project'}</h2>

      <div className="form-group">
        <label htmlFor="name">Project Name *</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome Project"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="url">Project URL *</label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="icon">Icon URL (optional)</label>
        <input
          type="url"
          id="icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="https://example.com/icon.png"
        />
      </div>

      {icon && (
        <div className="icon-preview">
          <img src={icon} alt="Icon preview" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {project ? 'Save Changes' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import type { ProjectManifest } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { getPublicQRPageUrl } from '../lib/manifest';
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
  const [copiedQRUrl, setCopiedQRUrl] = useState(false);

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

  const handleCopyPublicQRUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const publicQRPageUrl = getPublicQRPageUrl(project.id);
      await navigator.clipboard.writeText(publicQRPageUrl);
      setCopiedQRUrl(true);
      setTimeout(() => setCopiedQRUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Determine if using bundle or URL
  const isBundle = Boolean(project.bundlePath);
  const displayUrl = project.activityConfig.url;
  const webViewResolution = project.activityConfig.webViewResolution;

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
          {isBundle ? (
            <div className="bundle-indicator" onClick={(e) => e.stopPropagation()}>
              <span className="bundle-badge">📦 Bundle</span>
              <span className="bundle-url">file://{project.entryPoint || 'index.html'}</span>
            </div>
          ) : displayUrl ? (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="project-url"
              onClick={(e) => e.stopPropagation()}
            >
              {displayUrl}
            </a>
          ) : null}

          {webViewResolution != null && (
            <div className="webview-resolution">
              WebView Res: {webViewResolution.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {isFocused && (
        <div className="card-qr-section">
          <QRCodeDisplay
            project={project}
            size={300}
            showDetails={true}
          />
        </div>
      )}

      <div className="card-actions">
        <button className="btn-copy-qr" onClick={handleCopyPublicQRUrl} title="Copy Public QR Page URL">
          {copiedQRUrl ? 'Copied!' : 'Copy QR Link'}
        </button>
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

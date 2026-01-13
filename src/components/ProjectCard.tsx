import { useState } from 'react';
import type { ProjectManifest } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { getPublicQRPageUrl } from '../lib/manifest';

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
      className={`flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200 ${
        isFocused
          ? 'cursor-default shadow-2xl'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-xl'
      }`}
      onClick={onClick}
    >
      <div
        className="relative min-h-30 bg-gray-100 bg-cover bg-center bg-no-repeat flex items-end"
        style={project.icon ? { backgroundImage: `url(${project.icon})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white/95" />
        <div className="relative z-10 w-full px-5 py-4">
          <h3 className="m-0 mb-1 text-gray-900 text-xl font-semibold whitespace-nowrap overflow-hidden text-ellipsis [text-shadow:0_1px_2px_rgba(255,255,255,0.8)]">
            {project.name}
          </h3>
          {isBundle ? (
            <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold">
                📦 Bundle
              </span>
              <span className="text-sm text-blue-700 font-mono [text-shadow:0_1px_2px_rgba(255,255,255,0.8)]">
                file://{project.entryPoint || 'index.html'}
              </span>
            </div>
          ) : displayUrl ? (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-indigo-600 text-sm no-underline whitespace-nowrap overflow-hidden text-ellipsis [text-shadow:0_1px_2px_rgba(255,255,255,0.8)] hover:underline hover:text-indigo-700"
              onClick={(e) => e.stopPropagation()}
            >
              {displayUrl}
            </a>
          ) : null}

          {webViewResolution != null && (
            <div className="mt-1 text-gray-700 text-sm font-mono [text-shadow:0_1px_2px_rgba(255,255,255,0.8)]">
              WebView Res: {webViewResolution.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {isFocused && (
        <div className="flex justify-center p-5 bg-gray-50">
          <QRCodeDisplay
            project={project}
            size={300}
            showDetails={true}
          />
        </div>
      )}

      <div className="flex gap-3 px-5 pb-5">
        <button
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 bg-transparent text-emerald-500 border border-emerald-500 hover:bg-emerald-500 hover:text-white"
          onClick={handleCopyPublicQRUrl}
          title="Copy Public QR Page URL"
        >
          {copiedQRUrl ? 'Copied!' : 'Copy QR Link'}
        </button>
        <button
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 bg-transparent text-indigo-500 border border-indigo-500 hover:bg-indigo-500 hover:text-white"
          onClick={handleEdit}
        >
          Edit
        </button>
        <button
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 border border-red-500 ${
            confirmDelete
              ? 'bg-red-500 text-white'
              : 'bg-transparent text-red-500 hover:bg-red-500 hover:text-white'
          }`}
          onClick={handleDelete}
        >
          {confirmDelete ? 'Confirm Delete?' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

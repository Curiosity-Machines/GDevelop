import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import JSZip from 'jszip';
import type { ProjectManifest, ProjectFormData, SerializableActivityData, ActivitySourceType } from '../types';
import './ProjectForm.css';

interface UploadProgress {
  current: number;
  total: number;
  phase: 'preparing' | 'uploading' | 'complete';
}

interface ProjectFormProps {
  project?: ProjectManifest;
  onSubmit: (data: ProjectFormData, bundleFile?: File) => void;
  onCancel: () => void;
  uploadProgress?: UploadProgress | null;
}

export function ProjectForm({ project, onSubmit, onCancel, uploadProgress }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [sourceType, setSourceType] = useState<ActivitySourceType>('url');
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [entryPoints, setEntryPoints] = useState<string[]>([]);
  const [selectedEntryPoint, setSelectedEntryPoint] = useState('');
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setUrl(project.url || '');
      setIcon(project.icon || '');
      // Determine source type based on existing data
      if (project.bundlePath) {
        setSourceType('bundle');
        setSelectedEntryPoint(project.entryPoint || 'index.html');
      } else {
        setSourceType('url');
      }
    }
  }, [project]);

  // Parse zip file to extract HTML entry points
  const parseZipFile = async (file: File) => {
    setIsParsingZip(true);
    setZipError(null);
    setEntryPoints([]);
    setSelectedEntryPoint('');

    try {
      const zip = await JSZip.loadAsync(file);
      const htmlFiles: string[] = [];

      // Find all HTML files in the zip
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.html')) {
          htmlFiles.push(relativePath);
        }
      });

      if (htmlFiles.length === 0) {
        setZipError('No HTML files found in the zip. Please include an HTML entry point.');
        setBundleFile(null);
        return;
      }

      // Sort with index.html first, then by path
      htmlFiles.sort((a, b) => {
        const aIsIndex = a.toLowerCase().endsWith('index.html');
        const bIsIndex = b.toLowerCase().endsWith('index.html');
        if (aIsIndex && !bIsIndex) return -1;
        if (!aIsIndex && bIsIndex) return 1;
        return a.localeCompare(b);
      });

      setEntryPoints(htmlFiles);
      setBundleFile(file);
      // Auto-select first entry point (index.html if available)
      setSelectedEntryPoint(htmlFiles[0]);
    } catch {
      setZipError('Failed to parse zip file. Please ensure it\'s a valid zip archive.');
      setBundleFile(null);
    } finally {
      setIsParsingZip(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setZipError('Please select a ZIP file.');
        setBundleFile(null);
        return;
      }
      parseZipFile(file);
    }
  };

  const handleRemoveBundle = () => {
    setBundleFile(null);
    setEntryPoints([]);
    setSelectedEntryPoint('');
    setZipError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate based on source type
    if (sourceType === 'bundle' && !bundleFile && !project?.bundlePath) {
      setZipError('Please upload a zip file for the activity bundle.');
      return;
    }

    const activityConfig: SerializableActivityData = {
      activityName: name.trim(),
      url: sourceType === 'url' ? url.trim() || undefined : undefined,
      iconPath: icon.trim() || undefined,
    };

    onSubmit(
      {
        name: name.trim(),
        url: sourceType === 'url' ? url.trim() || undefined : undefined,
        icon: icon.trim() || undefined,
        entryPoint: sourceType === 'bundle' ? selectedEntryPoint || undefined : undefined,
        activityConfig,
      },
      sourceType === 'bundle' ? bundleFile || undefined : undefined
    );

    if (!project) {
      setName('');
      setUrl('');
      setIcon('');
      setBundleFile(null);
      setEntryPoints([]);
      setSelectedEntryPoint('');
    }
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <h2>{project ? 'Edit Activity' : 'Create New Activity'}</h2>

      <div className="form-section">
        <div className="section-content">
          <div className="form-group">
            <label htmlFor="name">Activity Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Activity"
              required
            />
          </div>

          {/* Source Type Toggle */}
          <div className="form-group">
            <label>Activity Source</label>
            <div className="source-toggle">
              <button
                type="button"
                className={`toggle-btn ${sourceType === 'url' ? 'active' : ''}`}
                onClick={() => setSourceType('url')}
              >
                🌐 Web URL
              </button>
              <button
                type="button"
                className={`toggle-btn ${sourceType === 'bundle' ? 'active' : ''}`}
                onClick={() => setSourceType('bundle')}
              >
                📦 Upload Bundle
              </button>
            </div>
          </div>

          {/* URL Input (shown when sourceType is 'url') */}
          {sourceType === 'url' && (
            <div className="form-group">
              <label htmlFor="url">Activity URL</label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/game"
              />
            </div>
          )}

          {/* Bundle Upload (shown when sourceType is 'bundle') */}
          {sourceType === 'bundle' && (
            <div className="bundle-section">
              {/* Show existing bundle info */}
              {project?.bundlePath && !bundleFile && (
                <div className="existing-bundle">
                  <div className="bundle-info">
                    <span className="bundle-icon">📦</span>
                    <div className="bundle-details">
                      <span className="bundle-label">Current Bundle</span>
                      <span className="bundle-entry">Entry: {project.entryPoint || 'index.html'}</span>
                    </div>
                  </div>
                  <span className="bundle-hint">Upload a new zip to replace</span>
                </div>
              )}

              {/* File Upload */}
              <div className="form-group">
                <label htmlFor="bundle">
                  {project?.bundlePath ? 'Replace Bundle (ZIP)' : 'Upload Bundle (ZIP)'}
                </label>
                <div className="file-upload-wrapper">
                  <input
                    type="file"
                    id="bundle"
                    ref={fileInputRef}
                    accept=".zip"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <label htmlFor="bundle" className="file-upload-label">
                    {isParsingZip ? (
                      <span className="parsing">Analyzing zip...</span>
                    ) : bundleFile ? (
                      <span className="file-selected">
                        <span className="file-name">{bundleFile.name}</span>
                        <span className="file-size">({(bundleFile.size / 1024).toFixed(1)} KB)</span>
                      </span>
                    ) : (
                      <span className="file-placeholder">
                        <span className="upload-icon">📁</span>
                        Click to select or drag & drop a ZIP file
                      </span>
                    )}
                  </label>
                  {bundleFile && (
                    <button type="button" className="btn-remove-file" onClick={handleRemoveBundle}>
                      ✕
                    </button>
                  )}
                </div>
                {zipError && <span className="error-message">{zipError}</span>}
              </div>

              {/* Entry Point Selection */}
              {entryPoints.length > 0 && (
                <div className="form-group">
                  <label htmlFor="entryPoint">Entry Point</label>
                  <select
                    id="entryPoint"
                    value={selectedEntryPoint}
                    onChange={(e) => setSelectedEntryPoint(e.target.value)}
                  >
                    {entryPoints.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Select the HTML file that should load when the activity starts
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="icon">Icon URL</label>
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
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="upload-progress-section">
          <div className="upload-progress-header">
            <span className="upload-progress-label">
              {uploadProgress.phase === 'preparing' && '📦 Preparing bundle...'}
              {uploadProgress.phase === 'uploading' && `📤 Uploading files...`}
              {uploadProgress.phase === 'complete' && '✅ Upload complete!'}
            </span>
            {uploadProgress.phase === 'uploading' && uploadProgress.total > 0 && (
              <span className="upload-progress-count">
                {uploadProgress.current} / {uploadProgress.total} files
              </span>
            )}
          </div>
          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{
                width: uploadProgress.total > 0
                  ? `${(uploadProgress.current / uploadProgress.total) * 100}%`
                  : uploadProgress.phase === 'preparing' ? '10%' : '100%',
              }}
            />
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={!!uploadProgress}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isParsingZip || !!uploadProgress}>
          {uploadProgress
            ? 'Uploading...'
            : project
              ? 'Save Changes'
              : 'Create Activity'}
        </button>
      </div>
    </form>
  );
}

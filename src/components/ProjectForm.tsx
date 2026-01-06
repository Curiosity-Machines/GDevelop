import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import JSZip from 'jszip';
import type { ProjectManifest, ProjectFormData, SerializableActivityData, ActivitySourceType, IconSourceType } from '../types';
import './ProjectForm.css';

// Unity-supported texture formats for UnityWebRequestTexture.GetTexture
const UNITY_SUPPORTED_EXTENSIONS = ['bmp', 'exr', 'hdr', 'iff', 'jpg', 'jpeg', 'pict', 'png', 'psd', 'tga', 'tiff', 'tif'];

// Image extensions to look for in bundles
const BUNDLE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'tga', 'tiff', 'tif', 'psd', 'hdr', 'exr', 'webp', 'gif'];

// Supported MIME types for data: URLs
const UNITY_SUPPORTED_MIME_TYPES = [
  'image/bmp',
  'image/x-exr',
  'image/vnd.radiance',
  'image/iff',
  'image/x-iff',
  'image/jpeg',
  'image/x-pict',
  'image/png',
  'image/vnd.adobe.photoshop',
  'image/x-targa',
  'image/x-tga',
  'image/tiff',
];

interface IconValidation {
  isValid: boolean;
  error?: string;
}

function validateIconUrl(url: string): IconValidation {
  if (!url.trim()) {
    return { isValid: true }; // Empty is valid (icon is optional)
  }

  const trimmedUrl = url.trim();

  // Check for data: URL
  if (trimmedUrl.startsWith('data:')) {
    // Validate data:image URL format
    const dataUrlMatch = trimmedUrl.match(/^data:(image\/[^;,]+)/i);
    if (!dataUrlMatch) {
      return {
        isValid: false,
        error: 'Data URL must be an image type (e.g., data:image/png;base64,...)',
      };
    }

    const mimeType = dataUrlMatch[1].toLowerCase();
    const isSupported = UNITY_SUPPORTED_MIME_TYPES.some(
      (supported) => mimeType === supported || mimeType.includes(supported.split('/')[1])
    );

    if (!isSupported) {
      return {
        isValid: false,
        error: `Unsupported image format. Dopple studio supports: PNG, JPG, BMP, TGA, TIFF, PSD, HDR, EXR`,
      };
    }

    return { isValid: true };
  }

  // Check for HTTPS URL
  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.protocol !== 'https:') {
      return {
        isValid: false,
        error: 'Icon URL must use HTTPS protocol for security',
      };
    }

    // Extract file extension from pathname
    const pathname = parsedUrl.pathname.toLowerCase();
    const extensionMatch = pathname.match(/\.([a-z0-9]+)$/i);

    if (!extensionMatch) {
      // No extension - we'll allow it but warn (some URLs serve images without extensions)
      return { isValid: true };
    }

    const extension = extensionMatch[1].toLowerCase();
    if (!UNITY_SUPPORTED_EXTENSIONS.includes(extension)) {
      return {
        isValid: false,
        error: `Unsupported image format (.${extension}). Unity supports: PNG, JPG, BMP, TGA, TIFF, PSD, HDR, EXR`,
      };
    }

    return { isValid: true };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format. Use an HTTPS URL or data:image URL',
    };
  }
}

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
  const [iconError, setIconError] = useState<string | null>(null);
  const [webViewResolutionOverride, setWebViewResolutionOverride] = useState<string>('');
  const [sourceType, setSourceType] = useState<ActivitySourceType>('url');
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [entryPoints, setEntryPoints] = useState<string[]>([]);
  const [selectedEntryPoint, setSelectedEntryPoint] = useState('');
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Icon from bundle support
  const [iconSourceType, setIconSourceType] = useState<IconSourceType>('url');
  const [bundleImageFiles, setBundleImageFiles] = useState<string[]>([]);
  const [selectedBundleIcon, setSelectedBundleIcon] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setUrl(project.url || '');
      setIcon(project.icon || '');
      const res = project.activityConfig.webViewResolution;
      setWebViewResolutionOverride(res != null && Math.abs(res - 1.0) > 0.0001 ? String(res) : '');
      // Determine source type based on existing data
      if (project.bundlePath) {
        setSourceType('bundle');
        setSelectedEntryPoint(project.entryPoint || 'index.html');
      } else {
        setSourceType('url');
      }
    }
  }, [project]);

  // Parse zip file to extract HTML entry points and image files
  const parseZipFile = async (file: File) => {
    setIsParsingZip(true);
    setZipError(null);
    setEntryPoints([]);
    setSelectedEntryPoint('');
    setBundleImageFiles([]);
    setSelectedBundleIcon('');

    try {
      const zip = await JSZip.loadAsync(file);
      const htmlFiles: string[] = [];
      const imageFiles: string[] = [];

      // Find all HTML and image files in the zip
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        
        const lowerPath = relativePath.toLowerCase();
        
        // Check for HTML files
        if (lowerPath.endsWith('.html')) {
          htmlFiles.push(relativePath);
        }
        
        // Check for image files
        const ext = lowerPath.split('.').pop();
        if (ext && BUNDLE_IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(relativePath);
        }
      });

      if (htmlFiles.length === 0) {
        setZipError('No HTML files found in the zip. Please include an HTML entry point.');
        setBundleFile(null);
        return;
      }

      // Sort HTML files with index.html first, then by path
      htmlFiles.sort((a, b) => {
        const aIsIndex = a.toLowerCase().endsWith('index.html');
        const bIsIndex = b.toLowerCase().endsWith('index.html');
        if (aIsIndex && !bIsIndex) return -1;
        if (!aIsIndex && bIsIndex) return 1;
        return a.localeCompare(b);
      });

      // Sort image files - prioritize common icon names, then alphabetically
      imageFiles.sort((a, b) => {
        const lowerA = a.toLowerCase();
        const lowerB = b.toLowerCase();
        const iconPriority = ['icon', 'logo', 'favicon'];
        
        const aHasPriority = iconPriority.some(p => lowerA.includes(p));
        const bHasPriority = iconPriority.some(p => lowerB.includes(p));
        
        if (aHasPriority && !bHasPriority) return -1;
        if (!aHasPriority && bHasPriority) return 1;
        return a.localeCompare(b);
      });

      setEntryPoints(htmlFiles);
      setBundleImageFiles(imageFiles);
      setBundleFile(file);
      // Auto-select first entry point (index.html if available)
      setSelectedEntryPoint(htmlFiles[0]);
      
      // If images found, default icon source to bundle_asset and select first
      if (imageFiles.length > 0) {
        setIconSourceType('bundle_asset');
        setSelectedBundleIcon(imageFiles[0]);
      }
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
    setBundleImageFiles([]);
    setSelectedBundleIcon('');
    setIconSourceType('url');
    setZipError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleIconChange = (value: string) => {
    setIcon(value);
    const validation = validateIconUrl(value);
    setIconError(validation.error || null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Determine the final icon value based on source type
    const isUsingBundleIcon = sourceType === 'bundle' && iconSourceType === 'bundle_asset' && selectedBundleIcon;
    const finalIconUrl = isUsingBundleIcon ? undefined : icon.trim() || undefined;
    const iconBundlePath = isUsingBundleIcon ? selectedBundleIcon : undefined;

    // Validate icon URL (only if using URL source)
    if (!isUsingBundleIcon) {
      const iconValidation = validateIconUrl(icon);
      if (!iconValidation.isValid) {
        setIconError(iconValidation.error || 'Invalid icon URL');
        return;
      }
    }

    // Validate based on source type
    if (sourceType === 'bundle' && !bundleFile && !project?.bundlePath) {
      setZipError('Please upload a zip file for the activity bundle.');
      return;
    }

    // Optional WebView resolution override (Vuplex CanvasWebViewPrefab.Resolution)
    let webViewResolution: number | undefined = undefined;
    const trimmedRes = webViewResolutionOverride.trim();
    if (trimmedRes) {
      const parsed = Number.parseFloat(trimmedRes);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        const clamped = Math.min(4.0, Math.max(0.25, parsed));
        // Store only if it differs from the default (1.0)
        if (Math.abs(clamped - 1.0) > 0.0001) {
          webViewResolution = clamped;
        }
      }
    }

    const activityConfig: SerializableActivityData = {
      activityName: name.trim(),
      url: sourceType === 'url' ? url.trim() || undefined : undefined,
      iconPath: finalIconUrl,
      webViewResolution,
    };

    onSubmit(
      {
        name: name.trim(),
        url: sourceType === 'url' ? url.trim() || undefined : undefined,
        icon: finalIconUrl,
        iconBundlePath,
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
      setBundleImageFiles([]);
      setSelectedBundleIcon('');
      setIconSourceType('url');
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

          {/* WebView Resolution Override */}
          <div className="form-group">
            <label htmlFor="webViewResolution">WebView Resolution Override (px / Unity unit)</label>
            <input
              type="number"
              id="webViewResolution"
              value={webViewResolutionOverride}
              onChange={(e) => setWebViewResolutionOverride(e.target.value)}
              placeholder="1.0 (default)"
              min={0.25}
              max={4.0}
              step={0.05}
            />
            <span className="field-hint">
              Optional. Sets Vuplex CanvasWebViewPrefab.Resolution. Default is 1.0. Values are clamped to 0.25–4.0.
            </span>
          </div>

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

          {/* Icon Section */}
          <div className="form-group">
            <label>Icon</label>
            
            {/* Show icon source toggle only when using bundle and bundle has images */}
            {sourceType === 'bundle' && bundleImageFiles.length > 0 && (
              <div className="icon-source-toggle">
                <button
                  type="button"
                  className={`toggle-btn-small ${iconSourceType === 'bundle_asset' ? 'active' : ''}`}
                  onClick={() => setIconSourceType('bundle_asset')}
                >
                  📦 From Bundle
                </button>
                <button
                  type="button"
                  className={`toggle-btn-small ${iconSourceType === 'url' ? 'active' : ''}`}
                  onClick={() => setIconSourceType('url')}
                >
                  🔗 URL
                </button>
              </div>
            )}
            
            {/* Icon from Bundle dropdown */}
            {sourceType === 'bundle' && iconSourceType === 'bundle_asset' && bundleImageFiles.length > 0 ? (
              <>
                <select
                  id="bundleIcon"
                  value={selectedBundleIcon}
                  onChange={(e) => setSelectedBundleIcon(e.target.value)}
                  className="bundle-icon-select"
                >
                  <option value="">No icon</option>
                  {bundleImageFiles.map((imgPath) => (
                    <option key={imgPath} value={imgPath}>
                      {imgPath}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Select an image from your bundle to use as the icon
                </span>
              </>
            ) : (
              <>
                <input
                  type="text"
                  id="icon"
                  value={icon}
                  onChange={(e) => handleIconChange(e.target.value)}
                  placeholder="https://example.com/icon.png"
                  className={iconError ? 'input-error' : ''}
                />
                {iconError && <span className="error-message">{iconError}</span>}
                <span className="field-hint">
                  HTTPS or data:image URL. Supported formats: PNG, JPG, BMP, TGA, TIFF, PSD, HDR, EXR
                </span>
              </>
            )}
          </div>

          {/* Icon preview for URL */}
          {iconSourceType === 'url' && icon && !iconError && (
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
        <button type="submit" className="btn-primary" disabled={isParsingZip || !!uploadProgress || !!iconError}>
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

import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import JSZip from 'jszip';
import type { ProjectManifest, ProjectFormData, ActivityFormConfig, ActivitySourceType, IconSourceType } from '../types';

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

    const activityConfig: ActivityFormConfig = {
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
    <form
      className="bg-white border border-gray-200 rounded-xl p-6 max-w-[700px] mx-auto max-h-[calc(100vh-120px)] overflow-y-auto"
      onSubmit={handleSubmit}
    >
      <h2 className="m-0 mb-6 text-gray-900 text-2xl">
        {project ? 'Edit Activity' : 'Create New Activity'}
      </h2>

      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-t border-gray-200 first:border-t-0">
          {/* Activity Name */}
          <div className="mb-4">
            <label htmlFor="name" className="block mb-1.5 text-gray-600 text-sm font-medium">
              Activity Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Activity"
              required
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-sm transition-colors duration-200 focus:outline-none focus:border-indigo-500 placeholder:text-gray-400"
            />
          </div>

          {/* Source Type Toggle */}
          <div className="mb-4">
            <label className="block mb-1.5 text-gray-600 text-sm font-medium">Activity Source</label>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                className={`flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ${
                  sourceType === 'url'
                    ? 'bg-white text-indigo-500 shadow-sm'
                    : 'bg-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setSourceType('url')}
              >
                🌐 Web URL
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ${
                  sourceType === 'bundle'
                    ? 'bg-white text-indigo-500 shadow-sm'
                    : 'bg-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setSourceType('bundle')}
              >
                📦 Upload Bundle
              </button>
            </div>
          </div>

          {/* URL Input (shown when sourceType is 'url') */}
          {sourceType === 'url' && (
            <div className="mb-4">
              <label htmlFor="url" className="block mb-1.5 text-gray-600 text-sm font-medium">
                Activity URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/game"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-sm transition-colors duration-200 focus:outline-none focus:border-indigo-500 placeholder:text-gray-400"
              />
            </div>
          )}

          {/* WebView Resolution Override */}
          <div className="mb-4">
            <label htmlFor="webViewResolution" className="block mb-1.5 text-gray-600 text-sm font-medium">
              WebView Resolution Override (px / Unity unit)
            </label>
            <input
              type="number"
              id="webViewResolution"
              value={webViewResolutionOverride}
              onChange={(e) => setWebViewResolutionOverride(e.target.value)}
              placeholder="1.0 (default)"
              min={0.25}
              max={4.0}
              step={0.05}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-sm transition-colors duration-200 focus:outline-none focus:border-indigo-500 placeholder:text-gray-400"
            />
            <span className="block mt-1.5 text-gray-400 text-xs">
              Optional. Sets Vuplex CanvasWebViewPrefab.Resolution. Default is 1.0. Values are clamped to 0.25-4.0.
            </span>
          </div>

          {/* Bundle Upload (shown when sourceType is 'bundle') */}
          {sourceType === 'bundle' && (
            <div className="mt-2">
              {/* Show existing bundle info */}
              {project?.bundlePath && !bundleFile && (
                <div className="flex justify-between items-center px-4 py-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📦</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-green-800 text-sm">Current Bundle</span>
                      <span className="text-xs text-green-700 font-mono">
                        Entry: {project.entryPoint || 'index.html'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 italic">Upload a new zip to replace</span>
                </div>
              )}

              {/* File Upload */}
              <div className="mb-4">
                <label htmlFor="bundle" className="block mb-1.5 text-gray-600 text-sm font-medium">
                  {project?.bundlePath ? 'Replace Bundle (ZIP)' : 'Upload Bundle (ZIP)'}
                </label>
                <div className="relative flex items-stretch">
                  <input
                    type="file"
                    id="bundle"
                    ref={fileInputRef}
                    accept=".zip"
                    onChange={handleFileChange}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <label
                    htmlFor="bundle"
                    className="flex-1 flex items-center justify-center px-4 py-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-indigo-500 hover:bg-indigo-50"
                  >
                    {isParsingZip ? (
                      <span className="text-indigo-500 italic">Analyzing zip...</span>
                    ) : bundleFile ? (
                      <span className="flex items-center gap-2 text-gray-700">
                        <span className="font-medium">{bundleFile.name}</span>
                        <span className="text-gray-400 text-sm">
                          ({(bundleFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-gray-500 text-sm">
                        <span className="text-2xl">📁</span>
                        Click to select or drag & drop a ZIP file
                      </span>
                    )}
                  </label>
                  {bundleFile && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center bg-red-500 text-white border-none rounded-full text-xs cursor-pointer transition-colors duration-200 hover:bg-red-600"
                      onClick={handleRemoveBundle}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {zipError && (
                  <span className="block mt-2 text-red-600 text-sm">{zipError}</span>
                )}
              </div>

              {/* Entry Point Selection */}
              {entryPoints.length > 0 && (
                <div className="mb-4">
                  <label htmlFor="entryPoint" className="block mb-1.5 text-gray-600 text-sm font-medium">
                    Entry Point
                  </label>
                  <select
                    id="entryPoint"
                    value={selectedEntryPoint}
                    onChange={(e) => setSelectedEntryPoint(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-sm transition-colors duration-200 focus:outline-none focus:border-indigo-500"
                  >
                    {entryPoints.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                  <span className="block mt-1.5 text-gray-400 text-xs">
                    Select the HTML file that should load when the activity starts
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Icon Section */}
          <div className="mb-4 last:mb-0">
            <label className="block mb-1.5 text-gray-600 text-sm font-medium">Icon</label>

            {/* Show icon source toggle only when using bundle and bundle has images */}
            {sourceType === 'bundle' && bundleImageFiles.length > 0 && (
              <div className="flex gap-1.5 bg-gray-100 p-0.5 rounded-md mb-2.5">
                <button
                  type="button"
                  className={`flex-1 px-3 py-1.5 border-none rounded text-xs font-medium cursor-pointer transition-all duration-200 ${
                    iconSourceType === 'bundle_asset'
                      ? 'bg-white text-indigo-500 shadow-sm'
                      : 'bg-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setIconSourceType('bundle_asset')}
                >
                  📦 From Bundle
                </button>
                <button
                  type="button"
                  className={`flex-1 px-3 py-1.5 border-none rounded text-xs font-medium cursor-pointer transition-all duration-200 ${
                    iconSourceType === 'url'
                      ? 'bg-white text-indigo-500 shadow-sm'
                      : 'bg-transparent text-gray-500 hover:text-gray-700'
                  }`}
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
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-sm font-mono transition-colors duration-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No icon</option>
                  {bundleImageFiles.map((imgPath) => (
                    <option key={imgPath} value={imgPath}>
                      {imgPath}
                    </option>
                  ))}
                </select>
                <span className="block mt-1.5 text-gray-400 text-xs">
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
                  className={`w-full px-3 py-2.5 bg-gray-50 border rounded-md text-gray-900 text-sm transition-colors duration-200 focus:outline-none placeholder:text-gray-400 ${
                    iconError
                      ? 'border-red-600 bg-red-50 focus:border-red-600'
                      : 'border-gray-200 focus:border-indigo-500'
                  }`}
                />
                {iconError && (
                  <span className="block mt-2 text-red-600 text-sm">{iconError}</span>
                )}
                <span className="block mt-1.5 text-gray-400 text-xs">
                  HTTPS or data:image URL. Supported formats: PNG, JPG, BMP, TGA, TIFF, PSD, HDR, EXR
                </span>
              </>
            )}
          </div>

          {/* Icon preview for URL */}
          {iconSourceType === 'url' && icon && !iconError && (
            <div className="flex justify-center mb-4">
              <img
                src={icon}
                alt="Icon preview"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                className="w-16 h-16 object-contain rounded-lg bg-gray-100 border border-gray-200 p-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-lg">
          <div className="flex justify-between items-center mb-2.5">
            <span className="font-medium text-sky-700 text-sm">
              {uploadProgress.phase === 'preparing' && '📦 Preparing bundle...'}
              {uploadProgress.phase === 'uploading' && `📤 Uploading files...`}
              {uploadProgress.phase === 'complete' && '✅ Upload complete!'}
            </span>
            {uploadProgress.phase === 'uploading' && uploadProgress.total > 0 && (
              <span className="text-sm text-sky-600 font-mono">
                {uploadProgress.current} / {uploadProgress.total} files
              </span>
            )}
          </div>
          <div className="h-2 bg-sky-100 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded transition-all duration-300"
              style={{
                width: uploadProgress.total > 0
                  ? `${(uploadProgress.current / uploadProgress.total) * 100}%`
                  : uploadProgress.phase === 'preparing' ? '10%' : '100%',
              }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-gray-200">
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 bg-transparent text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onCancel}
          disabled={!!uploadProgress}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 bg-indigo-500 text-white border-none hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isParsingZip || !!uploadProgress || !!iconError}
        >
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

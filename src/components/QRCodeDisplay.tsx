import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ProjectManifest, SerializableActivityData } from '../types';
import './QRCodeDisplay.css';

interface QRCodeDisplayProps {
  project: ProjectManifest;
  size?: number;
  showDetails?: boolean;
}

// Generate the activity manifest JSON from project data
function generateActivityManifest(project: ProjectManifest): SerializableActivityData {
  return {
    ...project.activityConfig,
    activityName: project.name,
    url: project.url,
    iconPath: project.icon,
  };
}

// Generate the API URL for programmatic access (curl, fetch, etc.)
function generateApiUrl(project: ProjectManifest): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/get-manifest?id=${project.id}`;
}

// Generate a manifest page URL for viewing in browser
function generateManifestPageUrl(project: ProjectManifest): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/manifest/${project.id}`;
}

export function QRCodeDisplay({ project, size = 200, showDetails = true }: QRCodeDisplayProps) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);

  const manifest = generateActivityManifest(project);
  const apiUrl = generateApiUrl(project);
  const manifestPageUrl = generateManifestPageUrl(project);
  const manifestJson = JSON.stringify(manifest, null, 2);

  const handleDownloadQR = () => {
    const svg = document.getElementById(`qr-${project.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = size * 2;
      canvas.height = size * 2;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${project.name.replace(/\s+/g, '-')}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadJson = () => {
    const blob = new Blob([manifestJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${project.name.replace(/\s+/g, '-')}-manifest.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(manifestJson);
      setCopied('json');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(apiUrl);
      setCopied('api');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(`curl "${apiUrl}"`);
      setCopied('curl');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="qr-code-display">
      <div className="qr-code-wrapper">
        <QRCodeSVG
          id={`qr-${project.id}`}
          value={apiUrl}
          size={size}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#111827"
        />
      </div>

      {showDetails && (
        <div className="qr-details">
          <div className="api-section">
            <label className="section-label">API Endpoint (for curl/fetch)</label>
            <div className="api-url-row">
              <code className="api-url">{apiUrl}</code>
              <button className="btn-small" onClick={handleCopyApiUrl}>
                {copied === 'api' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="curl-row">
              <code className="curl-command">curl "{apiUrl}"</code>
              <button className="btn-small" onClick={handleCopyCurl}>
                {copied === 'curl' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="page-section">
            <label className="section-label">View Manifest Page</label>
            <a href={manifestPageUrl} target="_blank" rel="noopener noreferrer" className="manifest-page-link">
              {manifestPageUrl}
            </a>
          </div>

          <div className="qr-actions">
            <button className="btn-action" onClick={handleDownloadQR}>
              Download QR
            </button>
            <button className="btn-action btn-json" onClick={() => setShowJson(!showJson)}>
              {showJson ? 'Hide JSON' : 'View JSON'}
            </button>
          </div>

          {showJson && (
            <div className="json-preview">
              <div className="json-header">
                <span>Activity Manifest</span>
                <div className="json-actions">
                  <button className="btn-small" onClick={handleCopyJson}>
                    {copied === 'json' ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="btn-small" onClick={handleDownloadJson}>
                    Download
                  </button>
                </div>
              </div>
              <pre className="json-content">{manifestJson}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

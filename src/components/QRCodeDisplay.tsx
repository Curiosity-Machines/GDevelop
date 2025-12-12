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

// Generate a manifest URL that returns the JSON config
function generateManifestUrl(project: ProjectManifest): string {
  // Use the current origin or a configured base URL for the manifest
  const baseUrl = window.location.origin;
  return `${baseUrl}/manifest/${project.id}`;
}

export function QRCodeDisplay({ project, size = 200, showDetails = true }: QRCodeDisplayProps) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const manifest = generateActivityManifest(project);
  const manifestUrl = generateManifestUrl(project);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopied(true);
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
          value={manifestUrl}
          size={size}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#111827"
        />
      </div>

      {showDetails && (
        <div className="qr-details">
          <p className="qr-value manifest-url">{manifestUrl}</p>

          <div className="qr-actions">
            <button className="btn-action" onClick={handleDownloadQR}>
              Download QR
            </button>
            <button className="btn-action" onClick={handleCopyUrl}>
              {copied ? 'Copied!' : 'Copy URL'}
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
                    Copy
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

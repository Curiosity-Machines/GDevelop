import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ProjectManifest } from '../types';
import { projectToDisplayManifest, getManifestApiUrl, getManifestBaseUrl, getManifestPageUrl, getPublicQRPageUrl } from '../lib/manifest';

interface QRCodeDisplayProps {
  project: ProjectManifest;
  size?: number;
  showDetails?: boolean;
}

export function QRCodeDisplay({ project, size = 500, showDetails = true }: QRCodeDisplayProps) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);

  const manifest = projectToDisplayManifest(project);
  const qrCodeUrl = getManifestBaseUrl(project.id); // Base URL for QR code (minimal info)
  const apiUrl = getManifestApiUrl(project.id); // Full URL with format=json for display
  const manifestPageUrl = getManifestPageUrl(project.id);
  const publicQRPageUrl = getPublicQRPageUrl(project.id);
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
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white rounded-xl p-2 shadow-lg">
        <QRCodeSVG
          id={`qr-${project.id}`}
          value={qrCodeUrl}
          size={size}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      {showDetails && (
        <div className="text-center w-full max-w-[450px]">
          {/* API Section */}
          <div className="mb-4 text-left">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">API Endpoint (for curl/fetch)</label>
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 px-3 py-2 bg-gray-800 text-emerald-500 font-mono text-[0.7rem] rounded-md break-all text-left">{apiUrl}</code>
              <button
                className="px-2.5 py-1 bg-indigo-500 text-white border-none rounded font-medium text-[0.7rem] cursor-pointer transition-colors duration-200 hover:bg-indigo-600"
                onClick={handleCopyApiUrl}
              >
                {copied === 'api' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 px-3 py-2 bg-gray-800 text-gray-50 font-mono text-[0.7rem] rounded-md break-all text-left">curl "{apiUrl}"</code>
              <button
                className="px-2.5 py-1 bg-indigo-500 text-white border-none rounded font-medium text-[0.7rem] cursor-pointer transition-colors duration-200 hover:bg-indigo-600"
                onClick={handleCopyCurl}
              >
                {copied === 'curl' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Page Section */}
          <div className="mb-4 text-left">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">View Manifest Page</label>
            <a
              href={manifestPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 bg-gray-100 text-indigo-500 font-mono text-[0.7rem] rounded-md break-all no-underline transition-colors duration-200 hover:bg-gray-200"
            >
              {manifestPageUrl}
            </a>
          </div>

          <div className="mb-4 text-left">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">View Public QR Page</label>
            <a
              href={publicQRPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 bg-gray-100 text-indigo-500 font-mono text-[0.7rem] rounded-md break-all no-underline transition-colors duration-200 hover:bg-gray-200"
            >
              {publicQRPageUrl}
            </a>
          </div>

          {/* QR Actions */}
          <div className="flex gap-2 justify-center flex-wrap mb-3">
            <button
              className="px-3.5 py-2 bg-emerald-500 text-white border-none rounded-md text-[0.8rem] font-medium cursor-pointer transition-colors duration-200 hover:bg-emerald-600"
              onClick={handleDownloadQR}
            >
              Download QR
            </button>
            <button
              className="px-3.5 py-2 bg-indigo-500 text-white border-none rounded-md text-[0.8rem] font-medium cursor-pointer transition-colors duration-200 hover:bg-indigo-600"
              onClick={() => setShowJson(!showJson)}
            >
              {showJson ? 'Hide JSON' : 'View JSON'}
            </button>
          </div>

          {/* JSON Preview */}
          {showJson && (
            <div className="text-left bg-gray-800 rounded-lg overflow-hidden mt-3">
              <div className="flex justify-between items-center px-3.5 py-2.5 bg-gray-700 border-b border-gray-600">
                <span className="text-gray-50 text-[0.85rem] font-medium">Activity Manifest</span>
                <div className="flex gap-1.5">
                  <button
                    className="px-2.5 py-1 bg-indigo-500 text-white border-none rounded font-medium text-[0.7rem] cursor-pointer transition-colors duration-200 hover:bg-indigo-600"
                    onClick={handleCopyJson}
                  >
                    {copied === 'json' ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    className="px-2.5 py-1 bg-indigo-500 text-white border-none rounded font-medium text-[0.7rem] cursor-pointer transition-colors duration-200 hover:bg-indigo-600"
                    onClick={handleDownloadJson}
                  >
                    Download
                  </button>
                </div>
              </div>
              <pre className="m-0 p-3.5 text-gray-200 font-mono text-[0.7rem] leading-normal overflow-x-auto max-h-[300px] overflow-y-auto">{manifestJson}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

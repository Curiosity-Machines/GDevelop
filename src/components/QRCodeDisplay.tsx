import { QRCodeSVG } from 'qrcode.react';
import type { ProjectManifest } from '../types';
import './QRCodeDisplay.css';

interface QRCodeDisplayProps {
  project: ProjectManifest;
  size?: number;
  showDetails?: boolean;
}

export function QRCodeDisplay({ project, size = 200, showDetails = true }: QRCodeDisplayProps) {
  const qrValue = `${project.name}:${project.url}`;

  const handleDownload = () => {
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

  return (
    <div className="qr-code-display">
      <div className="qr-code-wrapper">
        <QRCodeSVG
          id={`qr-${project.id}`}
          value={qrValue}
          size={size}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#1a1a2e"
        />
      </div>

      {showDetails && (
        <div className="qr-details">
          <p className="qr-value">{qrValue}</p>
          <button className="btn-download" onClick={handleDownload}>
            Download QR Code
          </button>
        </div>
      )}
    </div>
  );
}

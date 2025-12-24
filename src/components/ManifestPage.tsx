import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { activityToDisplayManifest, getManifestApiUrl, getPublicQRPageUrl, type DisplayManifest } from '../lib/manifest';
import './ManifestPage.css';

interface ManifestPageProps {
  projectId: string;
}

export function ManifestPage({ projectId }: ManifestPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [manifest, setManifest] = useState<DisplayManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | false>(false);

  const apiUrl = getManifestApiUrl(projectId);
  const publicQRPageUrl = getPublicQRPageUrl(projectId);

  useEffect(() => {
    // Check authentication and redirect if not authenticated
    if (!authLoading && !user) {
      window.location.href = publicQRPageUrl;
      return;
    }

    async function fetchManifest() {
      // Don't fetch if not authenticated
      if (!user) return;

      setLoading(true);
      setError(null);

      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', projectId)
        .single();

      if (activityError || !activity) {
        setError('Activity not found');
        setLoading(false);
        return;
      }

      setManifest(activityToDisplayManifest(activity));
      setLoading(false);
    }

    if (user) {
      fetchManifest();
    }
  }, [projectId, user, authLoading, publicQRPageUrl]);

  const handleCopy = async () => {
    if (!manifest) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
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

  const handleCopyPublicQRUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicQRPageUrl);
      setCopied('public-qr');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${manifest.activityName.replace(/\s+/g, '-')}-manifest.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  const handleDownloadQR = () => {
    if (!manifest) return;
    const svg = document.getElementById(`qr-${projectId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${manifest.activityName.replace(/\s+/g, '-')}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (authLoading || loading) {
    return (
      <div className="manifest-page">
        <div className="manifest-loading">
          <div className="loading-spinner"></div>
          <p>Loading manifest...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="manifest-page">
        <div className="manifest-error">
          <h2>Activity Not Found</h2>
          <p>The requested activity manifest could not be found.</p>
          <a href="/" className="btn-back">Go to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="manifest-page">
      <div className="manifest-container">
        <div className="manifest-header">
          <div className="manifest-title">
            <h1>{manifest.activityName}</h1>
            {manifest.url && <p className="manifest-url">{manifest.url}</p>}
          </div>
          <div className="manifest-actions">
            <button className="btn-action" onClick={handleCopy}>
              {copied === 'json' ? 'Copied!' : 'Copy JSON'}
            </button>
            <button className="btn-action btn-download" onClick={handleDownload}>
              Download
            </button>
            <a href="/" className="btn-action btn-back">Back to Studio</a>
          </div>
        </div>

        <div className="manifest-qr-section">
          <h3>Scan QR Code</h3>
          <div className="qr-wrapper">
            <QRCodeSVG
              id={`qr-${projectId}`}
              value={apiUrl}
              size={280}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <button className="btn-action btn-download-qr" onClick={handleDownloadQR}>
            Download QR Code
          </button>
          <div className="public-qr-link-section">
            <a href={publicQRPageUrl} target="_blank" rel="noopener noreferrer" className="public-qr-link">
              View Public QR Page →
            </a>
          </div>
        </div>

        <div className="manifest-content">
          <div className="manifest-info">
            <h3>Activity Manifest</h3>
            <p>This JSON configuration defines the Dopple Activity!</p>
          </div>
          <pre className="manifest-json">{JSON.stringify(manifest, null, 2)}</pre>
        </div>

        <div className="manifest-raw">
          <h3>API Endpoint</h3>
          <p>Fetch this manifest programmatically with curl or any HTTP client:</p>
          <div className="api-endpoint-section">
            <div className="endpoint-row">
              <code className="endpoint-url">{apiUrl}</code>
              <button className="btn-copy" onClick={handleCopyApiUrl}>
                {copied === 'api' ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
            <div className="curl-example">
              <span className="curl-label">curl command:</span>
              <div className="curl-row">
                <code className="curl-command">curl "{apiUrl}"</code>
                <button className="btn-copy" onClick={handleCopyCurl}>
                  {copied === 'curl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          <div className="public-qr-page-section">
            <h3>Public QR Page</h3>
            <p>Share this link to display the QR code publicly (no authentication required):</p>
            <div className="endpoint-row">
              <code className="endpoint-url">{publicQRPageUrl}</code>
              <button className="btn-copy" onClick={handleCopyPublicQRUrl}>
                {copied === 'public-qr' ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

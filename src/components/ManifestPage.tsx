import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { activityToDisplayManifest, getManifestApiUrl, getPublicQRPageUrl, type DisplayManifest } from '../lib/manifest';

export function ManifestPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [manifest, setManifest] = useState<DisplayManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | false>(false);

  const apiUrl = getManifestApiUrl(projectId || '');
  const publicQRPageUrl = getPublicQRPageUrl(projectId || '');

  useEffect(() => {
    // Check authentication and redirect if not authenticated
    if (!authLoading && !user) {
      window.location.href = publicQRPageUrl;
      return;
    }

    async function fetchManifest() {
      // Don't fetch if not authenticated or no project ID
      if (!user || !projectId) return;

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
      <div className="min-h-screen bg-gray-50 px-5 py-10">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
          <p>Loading manifest...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen bg-gray-50 px-5 py-10">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <h2 className="text-gray-900 mb-2">Activity Not Found</h2>
          <p className="text-gray-500 mb-6">The requested activity manifest could not be found.</p>
          <Link to="/" className="px-4.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 no-underline border border-gray-200 bg-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start gap-5 mb-6 flex-wrap max-sm:flex-col max-sm:items-stretch">
          <div>
            <h1 className="m-0 mb-1 text-gray-900 text-[1.75rem]">{manifest.activityName}</h1>
            {manifest.url && <p className="text-indigo-500 text-[0.9rem] m-0">{manifest.url}</p>}
          </div>
          <div className="flex gap-2.5 flex-wrap max-sm:justify-stretch">
            <button
              className="px-4.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 no-underline border-none bg-indigo-500 text-white hover:bg-indigo-600 max-sm:flex-1 max-sm:text-center"
              onClick={handleCopy}
            >
              {copied === 'json' ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              className="px-4.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 no-underline border-none bg-emerald-500 text-white hover:bg-emerald-600 max-sm:flex-1 max-sm:text-center"
              onClick={handleDownload}
            >
              Download
            </button>
            <Link
              to="/"
              className="px-4.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 no-underline bg-transparent text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900 max-sm:flex-1 max-sm:text-center"
            >
              Back to Studio
            </Link>
          </div>
        </div>

        {/* QR Section */}
        <div className="flex flex-col items-center gap-5 bg-white border border-gray-200 rounded-xl px-6 py-8 mb-6">
          <h3 className="m-0 text-gray-900 text-xl font-semibold">Scan QR Code</h3>
          <div className="bg-white rounded-lg shadow-md overflow-hidden [&>svg]:block">
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
          <button
            className="px-6 py-3 rounded-lg text-[0.9rem] font-medium cursor-pointer transition-all duration-200 no-underline border-none bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={handleDownloadQR}
          >
            Download QR Code
          </button>
          <div className="mt-3">
            <a
              href={publicQRPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4.5 py-2.5 text-indigo-500 no-underline text-sm font-medium border border-indigo-500 rounded-lg transition-all duration-200 hover:bg-indigo-500 hover:text-white"
            >
              View Public QR Page
            </a>
          </div>
        </div>

        {/* Manifest Content */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="m-0 mb-1 text-gray-900 text-base">Activity Manifest</h3>
            <p className="m-0 text-gray-500 text-sm">This JSON configuration defines the Dopple Activity!</p>
          </div>
          <pre className="m-0 p-5 bg-gray-800 text-gray-200 font-mono text-[0.8rem] leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto">{JSON.stringify(manifest, null, 2)}</pre>
        </div>

        {/* Raw/API Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="m-0 mb-2 text-gray-900 text-base">API Endpoint</h3>
          <p className="m-0 mb-3 text-gray-500 text-sm">Fetch this manifest programmatically with curl or any HTTP client:</p>
          <div className="mt-4">
            <div className="flex items-center gap-2.5 mb-3">
              <code className="flex-1 px-4 py-3 bg-gray-800 rounded-md font-mono text-[0.8rem] text-emerald-500 break-all">{apiUrl}</code>
              <button
                className="px-4 py-2.5 bg-indigo-500 text-white border-none rounded-md text-[0.8rem] font-medium cursor-pointer transition-colors duration-200 whitespace-nowrap hover:bg-indigo-600"
                onClick={handleCopyApiUrl}
              >
                {copied === 'api' ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">curl command:</span>
              <div className="flex items-center gap-2.5 mb-3">
                <code className="flex-1 px-4 py-3 bg-gray-800 rounded-md font-mono text-[0.8rem] text-gray-50 break-all">curl "{apiUrl}"</code>
                <button
                  className="px-4 py-2.5 bg-indigo-500 text-white border-none rounded-md text-[0.8rem] font-medium cursor-pointer transition-colors duration-200 whitespace-nowrap hover:bg-indigo-600"
                  onClick={handleCopyCurl}
                >
                  {copied === 'curl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="m-0 mb-2 text-gray-900 text-base">Public QR Page</h3>
            <p className="m-0 mb-3 text-gray-500 text-sm">Share this link to display the QR code publicly (no authentication required):</p>
            <div className="flex items-center gap-2.5 mb-3">
              <code className="flex-1 px-4 py-3 bg-gray-800 rounded-md font-mono text-[0.8rem] text-emerald-500 break-all">{publicQRPageUrl}</code>
              <button
                className="px-4 py-2.5 bg-indigo-500 text-white border-none rounded-md text-[0.8rem] font-medium cursor-pointer transition-colors duration-200 whitespace-nowrap hover:bg-indigo-600 no-underline inline-flex items-center"
                onClick={handleCopyPublicQRUrl}
              >
                {copied === 'public-qr' ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

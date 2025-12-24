import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { getManifestApiUrl } from '../lib/manifest';
import './PublicQRPage.css';

interface PublicQRPageProps {
  activityId: string;
}

export function PublicQRPage({ activityId }: PublicQRPageProps) {
  const [name, setName] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      setLoading(true);
      setError(null);

      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('name, icon_url')
        .eq('id', activityId)
        .single();

      if (activityError || !activity) {
        setError('Activity not found');
        setLoading(false);
        return;
      }

      setName(activity.name);
      setIconUrl(activity.icon_url);
      setLoading(false);
    }

    fetchActivity();
  }, [activityId]);

  const apiUrl = getManifestApiUrl(activityId);

  if (loading) {
    return (
      <div className="public-qr-page">
        <div className="public-qr-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !name) {
    return (
      <div className="public-qr-page">
        <div className="public-qr-error">
          <h2>Activity Not Found</h2>
          <p>The requested activity could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-qr-page">
      <div 
        className="public-qr-container"
        style={iconUrl ? { backgroundImage: `url(${iconUrl})` } : undefined}
      >
        <div className="public-qr-overlay" />
        <h1 className="public-qr-title">{name}</h1>
        <div className="public-qr-wrapper">
          <QRCodeSVG
            id={`public-qr-${activityId}`}
            value={apiUrl}
            size={400}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
        <div className="public-qr-footer">
          <a 
            href={window.location.origin} 
            className="public-qr-made-with"
            target="_blank"
            rel="noopener noreferrer"
          >
            Made with Dopple Studio →
          </a>
        </div>
      </div>
    </div>
  );
}


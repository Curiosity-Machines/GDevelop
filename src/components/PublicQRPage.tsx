import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { getManifestApiUrl } from '../lib/manifest';

export function PublicQRPage() {
  const { id: activityId } = useParams<{ id: string }>();
  const [name, setName] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      if (!activityId) {
        setError('Activity not found');
        setLoading(false);
        return;
      }

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

  const apiUrl = getManifestApiUrl(activityId || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-10">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 m-0">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !name) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-10">
        <div className="flex flex-col items-center justify-center text-center">
          <h2 className="text-gray-900 mb-2">Activity Not Found</h2>
          <p className="text-gray-500 m-0">The requested activity could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-10">
      <div
        className="relative bg-white bg-cover bg-center bg-no-repeat rounded-full px-12 py-10 shadow-lg flex flex-col items-center justify-center gap-6 max-w-[600px] w-[600px] aspect-square overflow-hidden max-sm:px-6 max-sm:py-8 max-sm:w-[calc(100vw-40px)] max-sm:max-w-[calc(100vw-40px)]"
        style={iconUrl ? { backgroundImage: `url(${iconUrl})` } : undefined}
      >
        <div className="absolute inset-0 bg-white/85 z-[1]" />
        <h1 className="relative z-[2] m-0 text-gray-900 text-[1.75rem] font-semibold text-center shrink-0 max-sm:text-2xl">{name}</h1>
        <div className="relative z-[2] bg-white rounded-xl p-4 shadow-md shrink-0 max-sm:p-3 [&>svg]:w-80 [&>svg]:h-80 max-sm:[&>svg]:w-full max-sm:[&>svg]:max-w-[280px] max-sm:[&>svg]:h-auto">
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
        <div className="relative z-[2] mt-0 shrink-0 bg-indigo-500/10 px-4 py-2 rounded-lg transition-all duration-200 hover:bg-indigo-500/15 hover:-translate-y-0.5 max-sm:px-3 max-sm:py-1.5">
          <a
            href={window.location.origin}
            className="bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent text-lg no-underline font-bold cursor-pointer inline-block hover:from-indigo-600 hover:to-violet-600 max-sm:text-base"
            target="_blank"
            rel="noopener noreferrer"
          >
            Made with Dopple Studio
          </a>
        </div>
      </div>
    </div>
  );
}

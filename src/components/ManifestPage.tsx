import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { SerializableActivityData, SerializableBubble, SerializableInputMapping } from '../types';
import { BubbleType, DeviceInput, KeyAction } from '../types';
import type { Activity, ActivityBubble, ActivityInputMapping } from '../types/database';
import './ManifestPage.css';

interface ManifestPageProps {
  projectId: string;
}

// Generate the API URL for programmatic access
function getApiUrl(projectId: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/get-manifest?id=${projectId}&format=json`;
}

// Convert DB rows to SerializableActivityData
function dbToManifest(
  activity: Activity,
  bubbles: ActivityBubble[],
  mappings: ActivityInputMapping[]
): SerializableActivityData {
  return {
    activityName: activity.name,
    url: activity.url,
    iconPath: activity.icon_url ?? undefined,
    description: activity.description ?? undefined,
    activityColor: {
      r: activity.color_r,
      g: activity.color_g,
      b: activity.color_b,
      a: activity.color_a,
    },
    requiredLevel: activity.required_level,
    isLocked: activity.is_locked,
    shouldUnlockByLumi: activity.should_unlock_by_lumi,
    recipeName: activity.recipe_name ?? undefined,
    recipeDescription: activity.recipe_description ?? undefined,
    useDefaultMapping: activity.use_default_mapping,
    inputUpdateRate: activity.input_update_rate,
    departureEmotion: activity.departure_emotion ?? undefined,
    arrivalEmotion: activity.arrival_emotion ?? undefined,
    levelUpMoveSpeed: activity.level_up_move_speed,
    enableOnArrival: activity.enable_on_arrival,
    enableDelay: activity.enable_delay,
    playEnableEffect: activity.play_enable_effect,
    requiredBubbles: bubbles
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((b): SerializableBubble => ({
        displayName: b.display_name ?? undefined,
        bubbleType: b.bubble_type as BubbleType,
        colorName: b.color_name ?? undefined,
        backgroundColor: {
          r: b.bg_color_r,
          g: b.bg_color_g,
          b: b.bg_color_b,
          a: b.bg_color_a,
        },
        colorTolerance: b.color_tolerance,
        useHSVMatching: b.use_hsv_matching,
        itemIds: b.item_ids,
      })),
    customInputMappings: mappings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m): SerializableInputMapping => ({
        mappingName: m.mapping_name ?? undefined,
        enabled: m.enabled,
        deviceInput: m.device_input as DeviceInput,
        keyboardKey: m.keyboard_key ?? '',
        keyAction: m.key_action as KeyAction,
        gyroThreshold: m.gyro_threshold,
        gyroSensitivity: m.gyro_sensitivity,
      })),
  };
}

export function ManifestPage({ projectId }: ManifestPageProps) {
  const [manifest, setManifest] = useState<SerializableActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | false>(false);

  const apiUrl = getApiUrl(projectId);

  useEffect(() => {
    async function fetchManifest() {
      setLoading(true);
      setError(null);

      // Fetch the activity
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

      // Fetch bubbles
      const { data: bubbles } = await supabase
        .from('activity_bubbles')
        .select('*')
        .eq('activity_id', projectId);

      // Fetch input mappings
      const { data: mappings } = await supabase
        .from('activity_input_mappings')
        .select('*')
        .eq('activity_id', projectId);

      const activityManifest = dbToManifest(
        activity,
        bubbles || [],
        mappings || []
      );

      setManifest(activityManifest);
      setLoading(false);
    }

    fetchManifest();
  }, [projectId]);

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

  if (loading) {
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
            <p className="manifest-url">{manifest.url}</p>
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
        </div>
      </div>
    </div>
  );
}

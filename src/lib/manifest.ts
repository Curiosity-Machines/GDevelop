import type { Activity } from '../types/database';
import type { ActivityWithRelations } from '../types';

// Display manifest (core fields only - bundleUrl is only returned by edge function)
export interface DisplayManifest {
  activityName: string;
  url?: string;
  iconPath?: string;
}

// Convert DB Activity row to display manifest
export function activityToDisplayManifest(activity: Activity): DisplayManifest {
  const manifest: DisplayManifest = {
    activityName: activity.name,
    iconPath: activity.icon_url ?? undefined,
  };

  // Use file:// URL format for bundles
  if (activity.bundle_path && activity.entry_point) {
    manifest.url = `file://${activity.entry_point}`;
  } else if (activity.url) {
    manifest.url = activity.url;
  }

  return manifest;
}

// Convert ActivityWithRelations (from hook) to display manifest
export function projectToDisplayManifest(project: ActivityWithRelations): DisplayManifest {
  return {
    activityName: project.name,
    url: project.activityConfig.url,
    iconPath: project.icon,
  };
}

// Generate the base API URL (for QR code - minimal information)
export function getManifestBaseUrl(activityId: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/get-manifest?id=${activityId}`;
}

// Generate the API URL for programmatic access (with format parameter)
export function getManifestApiUrl(activityId: string): string {
  return `${getManifestBaseUrl(activityId)}&format=json`;
}

// Generate a manifest page URL for viewing in browser
export function getManifestPageUrl(activityId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/manifest/${activityId}`;
}

// Generate a public QR page URL for viewing QR code and name
export function getPublicQRPageUrl(activityId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/qr/${activityId}`;
}



// Minimal activity data schema matching the Dopple device requirements
export interface SerializableActivityData {
  activityName: string;
  url?: string;
  iconPath?: string;
  bundleUrl?: string;  // URL to download the ZIP bundle (when using local bundle)
  webViewResolution?: number; // Vuplex CanvasWebViewPrefab.Resolution (px per Unity unit). Default is 1.0
}

// Default values for creating new activities
export const defaultActivityData: SerializableActivityData = {
  activityName: 'New Activity',
  url: '',
  iconPath: '',
  webViewResolution: 1.0,
};

// Source type for activity content
export type ActivitySourceType = 'url' | 'bundle';

// Source type for icon (when using bundles)
export type IconSourceType = 'url' | 'bundle_asset';

// Activity with relations (used by hook and components)
export interface ActivityWithRelations {
  id: string;
  name: string;
  url?: string;
  icon?: string;
  bundlePath?: string;    // Path to zip file in Supabase storage
  entryPoint?: string;    // Entry point within the zip (e.g., "index.html")
  activityConfig: SerializableActivityData;
  createdAt: number;
  updatedAt: number;
}

// Form data for creating/updating activities
export type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'> & {
  iconBundlePath?: string;  // Path to icon file within the bundle ZIP (e.g., "assets/icon.png")
};

// Legacy aliases for compatibility
export type ProjectManifest = ActivityWithRelations;
export type ProjectFormData = ActivityFormData;

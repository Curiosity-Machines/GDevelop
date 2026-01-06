import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Activity, ActivityInsert } from '../types/database';
import type { SerializableActivityData } from '../types';

// Full activity with related data
export interface ActivityWithRelations {
  id: string;
  name: string;
  url?: string;
  icon?: string;
  bundlePath?: string;
  entryPoint?: string;
  activityConfig: SerializableActivityData;
  createdAt: number;
  updatedAt: number;
}

// Form data for creating/updating
export type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'> & {
  iconBundlePath?: string;  // Path to icon file within the bundle ZIP (e.g., "assets/icon.png")
};

// Convert DB row to SerializableActivityData
function dbToActivityConfig(activity: Activity): SerializableActivityData {
  const config: SerializableActivityData = {
    activityName: activity.name,
    url: activity.url ?? undefined,
    iconPath: activity.icon_url ?? undefined,
    webViewResolution: activity.webview_resolution ?? undefined,
  };

  // If activity has a bundle, use file:// URL format and include bundleUrl
  if (activity.bundle_path && activity.entry_point) {
    config.url = `file://${activity.entry_point}`;
    config.bundleUrl = getBundleDownloadUrl(activity.bundle_path);
  }
  
  return config;
}

// Get the download URL for a bundle ZIP file
export function getBundleDownloadUrl(bundlePath: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/activity-bundles/${bundlePath}/bundle.zip`;
}

// Get the download URL for an icon stored in the activity-bundles bucket
export function getIconDownloadUrl(bundlePath: string, iconFileName: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/activity-bundles/${bundlePath}/${iconFileName}`;
}

// Get MIME type from file extension
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tga': 'image/x-targa',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'psd': 'image/vnd.adobe.photoshop',
    'hdr': 'image/vnd.radiance',
    'exr': 'image/x-exr',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export function useActivities() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: activityRows, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setActivities([]);
      setLoading(false);
      return;
    }

    if (!activityRows || activityRows.length === 0) {
      setActivities([]);
      setLoading(false);
      return;
    }

    // Convert to ActivityWithRelations
    const result: ActivityWithRelations[] = activityRows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url ?? undefined,
      icon: row.icon_url ?? undefined,
      bundlePath: row.bundle_path ?? undefined,
      entryPoint: row.entry_point ?? undefined,
      activityConfig: dbToActivityConfig(row),
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    setActivities(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Delete a bundle from storage
  const deleteBundle = useCallback(
    async (bundlePath: string): Promise<void> => {
      if (!user) return;
      const filePath = `${bundlePath}/bundle.zip`;
      await supabase.storage.from('activity-bundles').remove([filePath]);
    },
    [user]
  );

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    phase: 'preparing' | 'uploading' | 'complete';
  } | null>(null);

  // Upload a bundle zip file to Supabase storage (uploads ZIP as single file)
  const uploadBundle = useCallback(
    async (activityId: string, file: File): Promise<string | null> => {
      if (!user) return null;

      try {
        setUploadProgress({ current: 0, total: 1, phase: 'preparing' });

        // Create the file path: {user_id}/{activity_id}/bundle.zip
        const bundlePath = `${user.id}/${activityId}`;
        const filePath = `${bundlePath}/bundle.zip`;

        // Delete existing bundle if any
        await supabase.storage.from('activity-bundles').remove([filePath]);

        setUploadProgress({ current: 0, total: 1, phase: 'uploading' });

        // Upload the ZIP file directly
        const { error } = await supabase.storage
          .from('activity-bundles')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'application/zip',
          });

        if (error) {
          console.error('Failed to upload bundle:', error.message);
          setError('Failed to upload bundle: ' + error.message);
          return null;
        }

        setUploadProgress({ current: 1, total: 1, phase: 'complete' });
        return bundlePath;
      } catch (err) {
        setError('Failed to upload zip file');
        console.error('Bundle upload error:', err);
        return null;
      } finally {
        // Clear progress after a short delay
        setTimeout(() => setUploadProgress(null), 1000);
      }
    },
    [user]
  );

  // Extract and upload an icon from a bundle ZIP file
  const uploadIconFromBundle = useCallback(
    async (
      activityId: string,
      bundleFile: File,
      iconPath: string
    ): Promise<string | null> => {
      if (!user) return null;

      try {
        // Parse the ZIP file
        const zip = await JSZip.loadAsync(bundleFile);
        const iconFile = zip.file(iconPath);

        if (!iconFile) {
          console.error(`Icon file not found in bundle: ${iconPath}`);
          return null;
        }

        // Extract the icon as a blob
        const iconBlob = await iconFile.async('blob');
        
        // Get the filename (last part of the path)
        const iconFileName = 'icon.' + iconPath.split('.').pop();
        
        // Create the storage path: {user_id}/{activity_id}/icon.{ext}
        const bundlePath = `${user.id}/${activityId}`;
        const storagePath = `${bundlePath}/${iconFileName}`;

        // Delete existing icon if any
        await supabase.storage.from('activity-bundles').remove([storagePath]);

        // Upload the icon
        const { error } = await supabase.storage
          .from('activity-bundles')
          .upload(storagePath, iconBlob, {
            cacheControl: '86400', // 24 hours cache
            upsert: true,
            contentType: getMimeType(iconPath),
          });

        if (error) {
          console.error('Failed to upload icon from bundle:', error.message);
          return null;
        }

        // Return the public URL for the icon
        return getIconDownloadUrl(bundlePath, iconFileName);
      } catch (err) {
        console.error('Error extracting icon from bundle:', err);
        return null;
      }
    },
    [user]
  );

  const addActivity = useCallback(
    async (
      data: ActivityFormData,
      bundleFile?: File
    ): Promise<ActivityWithRelations | null> => {
      if (!user) return null;

      try {
        // First, create the activity to get its ID
        const activityInsert: ActivityInsert = {
          user_id: user.id,
          name: data.name,
          url: bundleFile ? null : data.url || null,
          icon_url: data.icon || null,
          bundle_path: null,
          entry_point: null,
          webview_resolution: data.activityConfig.webViewResolution ?? null,
        };

        const { data: newActivity, error: insertError } = await supabase
          .from('activities')
          .insert(activityInsert)
          .select()
          .single();

        if (insertError || !newActivity) {
          setError(insertError?.message || 'Failed to create activity');
          return null;
        }

        // If there's a bundle file, upload it and update the activity
        let bundlePath: string | null = null;
        let entryPoint: string | null = null;
        let iconUrl: string | null = data.icon || null;
        
        if (bundleFile) {
          bundlePath = await uploadBundle(newActivity.id, bundleFile);
          
          if (bundlePath) {
            entryPoint = data.entryPoint || 'index.html';
            
            // If there's an icon to extract from the bundle, do it
            if (data.iconBundlePath) {
              const uploadedIconUrl = await uploadIconFromBundle(
                newActivity.id,
                bundleFile,
                data.iconBundlePath
              );
              if (uploadedIconUrl) {
                iconUrl = uploadedIconUrl;
              }
            }
            
            // Update activity with bundle path and potentially new icon URL
            const { error: updateError } = await supabase
              .from('activities')
              .update({
                bundle_path: bundlePath,
                entry_point: entryPoint,
                icon_url: iconUrl,
              })
              .eq('id', newActivity.id);
              
            if (updateError) {
              console.error('Failed to update activity with bundle path:', updateError);
            }
          } else {
            // Bundle upload failed - activity was created but without bundle
            console.error('Bundle upload failed, activity created without bundle');
          }
        }

        const result: ActivityWithRelations = {
          id: newActivity.id,
          name: newActivity.name,
          url: bundlePath ? undefined : (newActivity.url ?? undefined),
          icon: iconUrl ?? undefined,
          bundlePath: bundlePath ?? undefined,
          entryPoint: entryPoint ?? undefined,
          activityConfig: dbToActivityConfig({
            ...newActivity,
            bundle_path: bundlePath,
            entry_point: entryPoint,
            icon_url: iconUrl,
          }),
          createdAt: new Date(newActivity.created_at).getTime(),
          updatedAt: new Date(newActivity.updated_at).getTime(),
        };

        setActivities((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        console.error('Error creating activity:', err);
        setError('Failed to create activity');
        return null;
      }
    },
    [user, uploadBundle, uploadIconFromBundle]
  );

  const updateActivity = useCallback(
    async (
      id: string,
      data: Partial<ActivityFormData>,
      bundleFile?: File,
      clearBundle?: boolean
    ): Promise<void> => {
      if (!user) return;

      // Get current activity to check for existing bundle
      const currentActivity = activities.find((a) => a.id === id);

      // Handle bundle changes
      let bundlePath = currentActivity?.bundlePath ?? null;
      let entryPoint = data.entryPoint ?? currentActivity?.entryPoint ?? null;
      let iconUrl: string | null = data.icon || currentActivity?.icon || null;
      const webViewResolution: number | null =
        data.activityConfig?.webViewResolution ??
        currentActivity?.activityConfig.webViewResolution ??
        null;

      if (clearBundle && currentActivity?.bundlePath) {
        // Clear the bundle
        await deleteBundle(currentActivity.bundlePath);
        bundlePath = null;
        entryPoint = null;
      } else if (bundleFile) {
        // Upload new bundle (replaces existing)
        const newPath = await uploadBundle(id, bundleFile);
        if (newPath) {
          bundlePath = newPath;
          entryPoint = data.entryPoint || 'index.html';
          
          // If there's an icon to extract from the bundle, do it
          if (data.iconBundlePath) {
            const uploadedIconUrl = await uploadIconFromBundle(
              id,
              bundleFile,
              data.iconBundlePath
            );
            if (uploadedIconUrl) {
              iconUrl = uploadedIconUrl;
            }
          }
        }
      } else if (data.iconBundlePath && bundlePath) {
        // Updating icon from existing bundle - we need to re-download and extract
        // For now, this case would require re-uploading the bundle
        // In a future enhancement, we could fetch the existing bundle and extract
        console.warn('Cannot change icon from bundle without re-uploading the bundle');
      }

      const { error: updateError } = await supabase
        .from('activities')
        .update({
          name: data.name,
          url: bundlePath ? null : data.url || null,
          icon_url: iconUrl,
          bundle_path: bundlePath,
          entry_point: entryPoint,
          webview_resolution: webViewResolution,
        })
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Update local state
      setActivities((prev) =>
        prev.map((activity) => {
          if (activity.id !== id) return activity;
          
          const updated = {
            ...activity,
            name: data.name ?? activity.name,
            url: bundlePath ? undefined : data.url,
            icon: iconUrl ?? undefined,
            bundlePath: bundlePath ?? undefined,
            entryPoint: entryPoint ?? undefined,
            updatedAt: Date.now(),
          };
          
          return {
            ...updated,
            activityConfig: dbToActivityConfig({
              id: activity.id,
              user_id: user.id,
              name: updated.name,
              url: updated.url ?? null,
              icon_url: updated.icon ?? null,
              bundle_path: updated.bundlePath ?? null,
              entry_point: updated.entryPoint ?? null,
              webview_resolution: webViewResolution,
              created_at: new Date(activity.createdAt).toISOString(),
              updated_at: new Date(updated.updatedAt).toISOString(),
            }),
          };
        })
      );
    },
    [user, activities, uploadBundle, uploadIconFromBundle, deleteBundle]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;

      // Get current activity to check for existing bundle
      const currentActivity = activities.find((a) => a.id === id);

      // Delete bundle from storage if exists
      if (currentActivity?.bundlePath) {
        await deleteBundle(currentActivity.bundlePath);
      }

      const { error: deleteError } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setActivities((prev) => prev.filter((activity) => activity.id !== id));
    },
    [user, activities, deleteBundle]
  );

  const getActivity = useCallback(
    (id: string): ActivityWithRelations | undefined => {
      return activities.find((activity) => activity.id === id);
    },
    [activities]
  );

  return {
    activities,
    loading,
    error,
    uploadProgress,
    addActivity,
    updateActivity,
    deleteActivity,
    getActivity,
    refetch: fetchActivities,
  };
}

import { useState, useEffect, useCallback } from 'react';
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
export type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'>;

// Convert DB row to SerializableActivityData
function dbToActivityConfig(activity: Activity): SerializableActivityData {
  const config: SerializableActivityData = {
    activityName: activity.name,
    url: activity.url ?? undefined,
    iconPath: activity.icon_url ?? undefined,
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
        
        if (bundleFile) {
          bundlePath = await uploadBundle(newActivity.id, bundleFile);
          
          if (bundlePath) {
            entryPoint = data.entryPoint || 'index.html';
            // Update activity with bundle path
            const { error: updateError } = await supabase
              .from('activities')
              .update({
                bundle_path: bundlePath,
                entry_point: entryPoint,
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
          icon: newActivity.icon_url ?? undefined,
          bundlePath: bundlePath ?? undefined,
          entryPoint: entryPoint ?? undefined,
          activityConfig: dbToActivityConfig({
            ...newActivity,
            bundle_path: bundlePath,
            entry_point: entryPoint,
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
    [user, uploadBundle]
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
        }
      }

      const { error: updateError } = await supabase
        .from('activities')
        .update({
          name: data.name,
          url: bundlePath ? null : data.url || null,
          icon_url: data.icon || null,
          bundle_path: bundlePath,
          entry_point: entryPoint,
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
            icon: data.icon,
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
              created_at: new Date(activity.createdAt).toISOString(),
              updated_at: new Date(updated.updatedAt).toISOString(),
            }),
          };
        })
      );
    },
    [user, activities, uploadBundle, deleteBundle]
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

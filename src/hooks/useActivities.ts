import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type {
  Activity,
  ActivityInsert,
  ActivityBubble,
  ActivityBubbleInsert,
  ActivityInputMapping,
  ActivityInputMappingInsert,
} from '../types/database';
import type {
  SerializableActivityData,
  SerializableBubble,
  SerializableInputMapping,
} from '../types';
import { BubbleType, DeviceInput, KeyAction } from '../types';

// Full activity with related data
export interface ActivityWithRelations {
  id: string;
  name: string;
  url: string;
  icon?: string;
  activityConfig: SerializableActivityData;
  createdAt: number;
  updatedAt: number;
}

// Form data for creating/updating
export type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'>;

// Convert DB row to SerializableActivityData
function dbToActivityConfig(
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

    // Fetch activities with related data
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

    const activityIds = activityRows.map((a) => a.id);

    // Fetch all bubbles for these activities
    const { data: bubbleRows } = await supabase
      .from('activity_bubbles')
      .select('*')
      .in('activity_id', activityIds);

    // Fetch all input mappings for these activities
    const { data: mappingRows } = await supabase
      .from('activity_input_mappings')
      .select('*')
      .in('activity_id', activityIds);

    // Group by activity
    const bubblesMap = new Map<string, ActivityBubble[]>();
    const mappingsMap = new Map<string, ActivityInputMapping[]>();

    (bubbleRows || []).forEach((b) => {
      const list = bubblesMap.get(b.activity_id) || [];
      list.push(b);
      bubblesMap.set(b.activity_id, list);
    });

    (mappingRows || []).forEach((m) => {
      const list = mappingsMap.get(m.activity_id) || [];
      list.push(m);
      mappingsMap.set(m.activity_id, list);
    });

    // Convert to ActivityWithRelations
    const result: ActivityWithRelations[] = activityRows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      icon: row.icon_url ?? undefined,
      activityConfig: dbToActivityConfig(
        row,
        bubblesMap.get(row.id) || [],
        mappingsMap.get(row.id) || []
      ),
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    setActivities(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addActivity = useCallback(
    async (data: ActivityFormData): Promise<ActivityWithRelations | null> => {
      if (!user) return null;

      const config = data.activityConfig;

      // Insert main activity
      const activityInsert: ActivityInsert = {
        user_id: user.id,
        name: data.name,
        url: data.url,
        icon_url: data.icon || null,
        description: config.description || null,
        color_r: config.activityColor?.r ?? 1,
        color_g: config.activityColor?.g ?? 1,
        color_b: config.activityColor?.b ?? 1,
        color_a: config.activityColor?.a ?? 1,
        required_level: config.requiredLevel ?? 1,
        is_locked: config.isLocked ?? false,
        should_unlock_by_lumi: config.shouldUnlockByLumi ?? false,
        recipe_name: config.recipeName || null,
        recipe_description: config.recipeDescription || null,
        use_default_mapping: config.useDefaultMapping ?? true,
        input_update_rate: config.inputUpdateRate ?? 0.01,
        departure_emotion: config.departureEmotion || null,
        arrival_emotion: config.arrivalEmotion || null,
        level_up_move_speed: config.levelUpMoveSpeed ?? 20,
        enable_on_arrival: config.enableOnArrival ?? true,
        enable_delay: config.enableDelay ?? 1,
        play_enable_effect: config.playEnableEffect ?? true,
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

      // Insert bubbles
      if (config.requiredBubbles && config.requiredBubbles.length > 0) {
        const bubbleInserts: ActivityBubbleInsert[] = config.requiredBubbles.map((b, i) => ({
          activity_id: newActivity.id,
          display_name: b.displayName || null,
          bubble_type: b.bubbleType,
          color_name: b.colorName || null,
          bg_color_r: b.backgroundColor?.r ?? 1,
          bg_color_g: b.backgroundColor?.g ?? 1,
          bg_color_b: b.backgroundColor?.b ?? 1,
          bg_color_a: b.backgroundColor?.a ?? 1,
          color_tolerance: b.colorTolerance ?? 0.15,
          use_hsv_matching: b.useHSVMatching ?? false,
          item_ids: b.itemIds || [],
          sort_order: i,
        }));

        await supabase.from('activity_bubbles').insert(bubbleInserts);
      }

      // Insert input mappings
      if (config.customInputMappings && config.customInputMappings.length > 0) {
        const mappingInserts: ActivityInputMappingInsert[] = config.customInputMappings.map((m, i) => ({
          activity_id: newActivity.id,
          mapping_name: m.mappingName || null,
          enabled: m.enabled ?? true,
          device_input: m.deviceInput,
          keyboard_key: m.keyboardKey || null,
          key_action: m.keyAction ?? 0,
          gyro_threshold: m.gyroThreshold ?? 0.2,
          gyro_sensitivity: m.gyroSensitivity ?? 1,
          sort_order: i,
        }));

        await supabase.from('activity_input_mappings').insert(mappingInserts);
      }

      const result: ActivityWithRelations = {
        id: newActivity.id,
        name: newActivity.name,
        url: newActivity.url,
        icon: newActivity.icon_url ?? undefined,
        activityConfig: config,
        createdAt: new Date(newActivity.created_at).getTime(),
        updatedAt: new Date(newActivity.updated_at).getTime(),
      };

      setActivities((prev) => [result, ...prev]);
      return result;
    },
    [user]
  );

  const updateActivity = useCallback(
    async (id: string, data: Partial<ActivityFormData>): Promise<void> => {
      if (!user) return;

      const config = data.activityConfig;

      // Update main activity
      if (config) {
        const { error: updateError } = await supabase
          .from('activities')
          .update({
            name: data.name,
            url: data.url,
            icon_url: data.icon || null,
            description: config.description || null,
            color_r: config.activityColor?.r ?? 1,
            color_g: config.activityColor?.g ?? 1,
            color_b: config.activityColor?.b ?? 1,
            color_a: config.activityColor?.a ?? 1,
            required_level: config.requiredLevel ?? 1,
            is_locked: config.isLocked ?? false,
            should_unlock_by_lumi: config.shouldUnlockByLumi ?? false,
            recipe_name: config.recipeName || null,
            recipe_description: config.recipeDescription || null,
            use_default_mapping: config.useDefaultMapping ?? true,
            input_update_rate: config.inputUpdateRate ?? 0.01,
            departure_emotion: config.departureEmotion || null,
            arrival_emotion: config.arrivalEmotion || null,
            level_up_move_speed: config.levelUpMoveSpeed ?? 20,
            enable_on_arrival: config.enableOnArrival ?? true,
            enable_delay: config.enableDelay ?? 1,
            play_enable_effect: config.playEnableEffect ?? true,
          })
          .eq('id', id);

        if (updateError) {
          setError(updateError.message);
          return;
        }

        // Replace bubbles (delete all, then insert new)
        await supabase.from('activity_bubbles').delete().eq('activity_id', id);
        if (config.requiredBubbles && config.requiredBubbles.length > 0) {
          const bubbleInserts: ActivityBubbleInsert[] = config.requiredBubbles.map((b, i) => ({
            activity_id: id,
            display_name: b.displayName || null,
            bubble_type: b.bubbleType,
            color_name: b.colorName || null,
            bg_color_r: b.backgroundColor?.r ?? 1,
            bg_color_g: b.backgroundColor?.g ?? 1,
            bg_color_b: b.backgroundColor?.b ?? 1,
            bg_color_a: b.backgroundColor?.a ?? 1,
            color_tolerance: b.colorTolerance ?? 0.15,
            use_hsv_matching: b.useHSVMatching ?? false,
            item_ids: b.itemIds || [],
            sort_order: i,
          }));
          await supabase.from('activity_bubbles').insert(bubbleInserts);
        }

        // Replace input mappings
        await supabase.from('activity_input_mappings').delete().eq('activity_id', id);
        if (config.customInputMappings && config.customInputMappings.length > 0) {
          const mappingInserts: ActivityInputMappingInsert[] = config.customInputMappings.map((m, i) => ({
            activity_id: id,
            mapping_name: m.mappingName || null,
            enabled: m.enabled ?? true,
            device_input: m.deviceInput,
            keyboard_key: m.keyboardKey || null,
            key_action: m.keyAction ?? 0,
            gyro_threshold: m.gyroThreshold ?? 0.2,
            gyro_sensitivity: m.gyroSensitivity ?? 1,
            sort_order: i,
          }));
          await supabase.from('activity_input_mappings').insert(mappingInserts);
        }
      }

      // Update local state
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === id
            ? { ...activity, ...data, updatedAt: Date.now() }
            : activity
        )
      );
    },
    [user]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;

      // Cascading delete will handle bubbles and mappings
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
    [user]
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
    addActivity,
    updateActivity,
    deleteActivity,
    getActivity,
    refetch: fetchActivities,
  };
}

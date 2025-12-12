export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          url: string;
          icon_url: string | null;
          description: string | null;
          color_r: number;
          color_g: number;
          color_b: number;
          color_a: number;
          required_level: number;
          is_locked: boolean;
          should_unlock_by_lumi: boolean;
          recipe_name: string | null;
          recipe_description: string | null;
          use_default_mapping: boolean;
          input_update_rate: number;
          departure_emotion: string | null;
          arrival_emotion: string | null;
          level_up_move_speed: number;
          enable_on_arrival: boolean;
          enable_delay: number;
          play_enable_effect: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          url: string;
          icon_url?: string | null;
          description?: string | null;
          color_r?: number;
          color_g?: number;
          color_b?: number;
          color_a?: number;
          required_level?: number;
          is_locked?: boolean;
          should_unlock_by_lumi?: boolean;
          recipe_name?: string | null;
          recipe_description?: string | null;
          use_default_mapping?: boolean;
          input_update_rate?: number;
          departure_emotion?: string | null;
          arrival_emotion?: string | null;
          level_up_move_speed?: number;
          enable_on_arrival?: boolean;
          enable_delay?: number;
          play_enable_effect?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          icon_url?: string | null;
          description?: string | null;
          color_r?: number;
          color_g?: number;
          color_b?: number;
          color_a?: number;
          required_level?: number;
          is_locked?: boolean;
          should_unlock_by_lumi?: boolean;
          recipe_name?: string | null;
          recipe_description?: string | null;
          use_default_mapping?: boolean;
          input_update_rate?: number;
          departure_emotion?: string | null;
          arrival_emotion?: string | null;
          level_up_move_speed?: number;
          enable_on_arrival?: boolean;
          enable_delay?: number;
          play_enable_effect?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_bubbles: {
        Row: {
          id: string;
          activity_id: string;
          display_name: string | null;
          bubble_type: number;
          color_name: string | null;
          bg_color_r: number;
          bg_color_g: number;
          bg_color_b: number;
          bg_color_a: number;
          color_tolerance: number;
          use_hsv_matching: boolean;
          item_ids: string[];
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          display_name?: string | null;
          bubble_type?: number;
          color_name?: string | null;
          bg_color_r?: number;
          bg_color_g?: number;
          bg_color_b?: number;
          bg_color_a?: number;
          color_tolerance?: number;
          use_hsv_matching?: boolean;
          item_ids?: string[];
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          display_name?: string | null;
          bubble_type?: number;
          color_name?: string | null;
          bg_color_r?: number;
          bg_color_g?: number;
          bg_color_b?: number;
          bg_color_a?: number;
          color_tolerance?: number;
          use_hsv_matching?: boolean;
          item_ids?: string[];
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_bubbles_activity_id_fkey";
            columns: ["activity_id"];
            referencedRelation: "activities";
            referencedColumns: ["id"];
          }
        ];
      };
      activity_input_mappings: {
        Row: {
          id: string;
          activity_id: string;
          mapping_name: string | null;
          enabled: boolean;
          device_input: number;
          keyboard_key: string | null;
          key_action: number;
          gyro_threshold: number;
          gyro_sensitivity: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          mapping_name?: string | null;
          enabled?: boolean;
          device_input?: number;
          keyboard_key?: string | null;
          key_action?: number;
          gyro_threshold?: number;
          gyro_sensitivity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          mapping_name?: string | null;
          enabled?: boolean;
          device_input?: number;
          keyboard_key?: string | null;
          key_action?: number;
          gyro_threshold?: number;
          gyro_sensitivity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_input_mappings_activity_id_fkey";
            columns: ["activity_id"];
            referencedRelation: "activities";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier access
export type Activity = Database['public']['Tables']['activities']['Row'];
export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];
export type ActivityUpdate = Database['public']['Tables']['activities']['Update'];

export type ActivityBubble = Database['public']['Tables']['activity_bubbles']['Row'];
export type ActivityBubbleInsert = Database['public']['Tables']['activity_bubbles']['Insert'];

export type ActivityInputMapping = Database['public']['Tables']['activity_input_mappings']['Row'];
export type ActivityInputMappingInsert = Database['public']['Tables']['activity_input_mappings']['Insert'];

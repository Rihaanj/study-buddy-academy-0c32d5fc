export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_buffs: {
        Row: {
          activated_at: string
          buff_key: string
          category: string
          expires_at: string | null
          id: string
          multiplier: number
          rarity: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          buff_key: string
          category?: string
          expires_at?: string | null
          id?: string
          multiplier?: number
          rarity?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          buff_key?: string
          category?: string
          expires_at?: string | null
          id?: string
          multiplier?: number
          rarity?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_history: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          prompt: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          prompt?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          prompt?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          sort_order: number
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          key: string
          sort_order?: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      burn_list: {
        Row: {
          created_at: string
          expected_answer: string
          id: string
          last_wrong_at: string
          question: string
          resolved: boolean
          times_wrong: number
          topic: string | null
          user_answer: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_answer: string
          id?: string
          last_wrong_at?: string
          question: string
          resolved?: boolean
          times_wrong?: number
          topic?: string | null
          user_answer?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expected_answer?: string
          id?: string
          last_wrong_at?: string
          question?: string
          resolved?: boolean
          times_wrong?: number
          topic?: string | null
          user_answer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_reads: {
        Row: {
          chat_id: string
          chat_kind: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          chat_kind: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          chat_kind?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cheat_reports: {
        Row: {
          context: string | null
          created_at: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      daily_buff_usage: {
        Row: {
          count: number
          day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_pack_grants: {
        Row: {
          created_at: string
          day: string
          milestone_streak: number | null
          packs_granted: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          milestone_streak?: number | null
          packs_granted?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          milestone_streak?: number | null
          packs_granted?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_xp_progress: {
        Row: {
          day: string
          levels_gained: number
          updated_at: string
          user_id: string
          xp_gained: number
        }
        Insert: {
          day: string
          levels_gained?: number
          updated_at?: string
          user_id: string
          xp_gained?: number
        }
        Update: {
          day?: string
          levels_gained?: number
          updated_at?: string
          user_id?: string
          xp_gained?: number
        }
        Relationships: []
      }
      dm_chats: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          chat_id: string
          created_at: string
          deleted: boolean
          id: string
          image_url: string | null
          text: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          deleted?: boolean
          id?: string
          image_url?: string | null
          text?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          deleted?: boolean
          id?: string
          image_url?: string | null
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "dm_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          duration_minutes: number
          id: string
          notes: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          ease_factor: number
          front: string
          id: string
          last_result: string | null
          last_reviewed_at: string | null
          next_review_at: string
          review_interval_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          ease_factor?: number
          front: string
          id?: string
          last_result?: string | null
          last_reviewed_at?: string | null
          next_review_at?: string
          review_interval_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          ease_factor?: number
          front?: string
          id?: string
          last_result?: string | null
          last_reviewed_at?: string | null
          next_review_at?: string
          review_interval_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          completed_at: string
          duration_minutes: number
          id: string
          integrity_score: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          completed_at?: string
          duration_minutes: number
          id?: string
          integrity_score?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          completed_at?: string
          duration_minutes?: number
          id?: string
          integrity_score?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          status: string
          to_user: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          status?: string
          to_user: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          status?: string
          to_user?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          acquired_at: string
          id: string
          item_key: string
          item_type: string
          metadata: Json
          rarity: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_key: string
          item_type: string
          metadata?: Json
          rarity?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_key?: string
          item_type?: string
          metadata?: Json
          rarity?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          deleted: boolean
          group_id: string
          id: string
          image_url: string | null
          text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          group_id: string
          id?: string
          image_url?: string | null
          text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          group_id?: string
          id?: string
          image_url?: string | null
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: Json
          avatar_url: string | null
          created_at: string
          email: string | null
          focus_streak: number
          id: string
          last_active_date: string | null
          last_buff_activated_at: string | null
          last_review_prompt_at: string | null
          last_task_xp_at: string | null
          level: number
          name: string | null
          pack_pity_count: number
          streak: number
          updated_at: string
          user_id: string
          visited_tabs: string[]
          weather_city: string | null
          weather_lat: number | null
          weather_lon: number | null
          xp: number
        }
        Insert: {
          avatar?: Json
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          focus_streak?: number
          id?: string
          last_active_date?: string | null
          last_buff_activated_at?: string | null
          last_review_prompt_at?: string | null
          last_task_xp_at?: string | null
          level?: number
          name?: string | null
          pack_pity_count?: number
          streak?: number
          updated_at?: string
          user_id: string
          visited_tabs?: string[]
          weather_city?: string | null
          weather_lat?: number | null
          weather_lon?: number | null
          xp?: number
        }
        Update: {
          avatar?: Json
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          focus_streak?: number
          id?: string
          last_active_date?: string | null
          last_buff_activated_at?: string | null
          last_review_prompt_at?: string | null
          last_task_xp_at?: string | null
          level?: number
          name?: string | null
          pack_pity_count?: number
          streak?: number
          updated_at?: string
          user_id?: string
          visited_tabs?: string[]
          weather_city?: string | null
          weather_lat?: number | null
          weather_lon?: number | null
          xp?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_resources: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_type: string
          id: string
          size_bytes: number
          subject: string | null
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_type: string
          id?: string
          size_bytes?: number
          subject?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          size_bytes?: number
          subject?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          awarded_xp: boolean
          completed: boolean
          confidence: number
          created_at: string
          difficulty: string
          due_date: string | null
          grade_importance: number
          id: string
          priority_score: number
          steps: Json
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_xp?: boolean
          completed?: boolean
          confidence?: number
          created_at?: string
          difficulty?: string
          due_date?: string | null
          grade_importance?: number
          id?: string
          priority_score?: number
          steps?: Json
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_xp?: boolean
          completed?: boolean
          confidence?: number
          created_at?: string
          difficulty?: string
          due_date?: string | null
          grade_importance?: number
          id?: string
          priority_score?: number
          steps?: Json
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          attempts: number
          correct: number
          created_at: string
          id: string
          last_practiced_at: string
          mastery_pct: number
          next_review_at: string
          subject: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          created_at?: string
          id?: string
          last_practiced_at?: string
          mastery_pct?: number
          next_review_at?: string
          subject?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correct?: number
          created_at?: string
          id?: string
          last_practiced_at?: string
          mastery_pct?: number
          next_review_at?: string
          subject?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_leaderboard_rewards: {
        Row: {
          created_at: string
          id: string
          packs_awarded: number
          reward_type: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          packs_awarded: number
          reward_type: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          packs_awarded?: number
          reward_type?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_scores: {
        Row: {
          focus_delta: number
          focus_start: number
          score: number
          updated_at: string
          user_id: string
          week_start: string
          xp_delta: number
          xp_start: number
        }
        Insert: {
          focus_delta?: number
          focus_start?: number
          score?: number
          updated_at?: string
          user_id: string
          week_start: string
          xp_delta?: number
          xp_start?: number
        }
        Update: {
          focus_delta?: number
          focus_start?: number
          score?: number
          updated_at?: string
          user_id?: string
          week_start?: string
          xp_delta?: number
          xp_start?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_inventory_buff: { Args: { _buff_id: string }; Returns: Json }
      admin_apply_level_penalty: {
        Args: { _report_id?: string; _user_id: string }
        Returns: undefined
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      ensure_weekly_score: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_dm_participant: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_host: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      iso_monday: { Args: { _d: string }; Returns: string }
      level_from_xp: { Args: { _xp: number }; Returns: number }
      refresh_weekly_score: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

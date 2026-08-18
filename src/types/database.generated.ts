export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_id: string | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          meeting_id: string;
          priority: Database["public"]["Enums"]["action_priority"];
          search_vector: unknown;
          task: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id: string;
          priority?: Database["public"]["Enums"]["action_priority"];
          search_vector?: unknown;
          task: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id?: string;
          priority?: Database["public"]["Enums"]["action_priority"];
          search_vector?: unknown;
          task?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_items_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: {
          actor_id: string | null;
          committee_id: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string;
          event_type: string;
          id: string;
        };
        Insert: {
          actor_id?: string | null;
          committee_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type: string;
          event_type: string;
          id?: string;
        };
        Update: {
          actor_id?: string | null;
          committee_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string;
          event_type?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
        ];
      };
      allowed_email_domains: {
        Row: {
          created_at: string;
          domain: string;
          enabled: boolean;
          id: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          domain: string;
          enabled?: boolean;
          id?: never;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          domain?: string;
          enabled?: boolean;
          id?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      backup_runs: {
        Row: {
          checksum_sha256: string | null;
          created_at: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          object_key: string | null;
          retention_class: string | null;
          size_bytes: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["backup_status"];
        };
        Insert: {
          checksum_sha256?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          object_key?: string | null;
          retention_class?: string | null;
          size_bytes?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["backup_status"];
        };
        Update: {
          checksum_sha256?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          object_key?: string | null;
          retention_class?: string | null;
          size_bytes?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["backup_status"];
        };
        Relationships: [];
      };
      committee_members: {
        Row: {
          committee_id: string;
          id: string;
          joined_at: string;
          profile_id: string;
          role_id: string;
        };
        Insert: {
          committee_id: string;
          id?: string;
          joined_at?: string;
          profile_id: string;
          role_id: string;
        };
        Update: {
          committee_id?: string;
          id?: string;
          joined_at?: string;
          profile_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "committee_members_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "committee_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      committee_roles: {
        Row: {
          access_level: Database["public"]["Enums"]["committee_access_level"];
          created_at: string;
          id: string;
          is_system: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          access_level: Database["public"]["Enums"]["committee_access_level"];
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          access_level?: Database["public"]["Enums"]["committee_access_level"];
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      committees: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          mandate: string;
          name: string;
          search_vector: unknown;
          status: Database["public"]["Enums"]["committee_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mandate?: string;
          name: string;
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["committee_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mandate?: string;
          name?: string;
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["committee_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "committees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          committee_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          target_date: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          committee_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          target_date?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          committee_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_attendance: {
        Row: {
          created_at: string;
          id: string;
          marked_at: string | null;
          marked_by: string | null;
          meeting_id: string;
          present: boolean;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          marked_at?: string | null;
          marked_by?: string | null;
          meeting_id: string;
          present?: boolean;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          marked_at?: string | null;
          marked_by?: string | null;
          meeting_id?: string;
          present?: boolean;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_attendance_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          agenda: string;
          archived_at: string | null;
          committee_id: string;
          created_at: string;
          created_by: string | null;
          finalized_at: string | null;
          finalized_by: string | null;
          goals: string;
          id: string;
          minutes: string;
          search_vector: unknown;
          started_at: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["meeting_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          agenda?: string;
          archived_at?: string | null;
          committee_id: string;
          created_at?: string;
          created_by?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          goals?: string;
          id?: string;
          minutes?: string;
          search_vector?: unknown;
          started_at?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["meeting_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          agenda?: string;
          archived_at?: string | null;
          committee_id?: string;
          created_at?: string;
          created_by?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          goals?: string;
          id?: string;
          minutes?: string;
          search_vector?: unknown;
          started_at?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["meeting_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_finalized_by_fkey";
            columns: ["finalized_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department: string | null;
          email: string;
          full_name: string;
          global_role: Database["public"]["Enums"]["global_role"];
          id: string;
          last_seen_at: string | null;
          person_category: Database["public"]["Enums"]["person_category"];
          search_vector: unknown;
          status: Database["public"]["Enums"]["account_status"];
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department?: string | null;
          email: string;
          full_name: string;
          global_role?: Database["public"]["Enums"]["global_role"];
          id: string;
          last_seen_at?: string | null;
          person_category?: Database["public"]["Enums"]["person_category"];
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["account_status"];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string;
          global_role?: Database["public"]["Enums"]["global_role"];
          id?: string;
          last_seen_at?: string | null;
          person_category?: Database["public"]["Enums"]["person_category"];
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["account_status"];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      resource_groups: {
        Row: {
          committee_id: string;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          committee_id: string;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          committee_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_groups_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_links: {
        Row: {
          created_at: string;
          description: string;
          group_id: string;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          group_id: string;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          group_id?: string;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_links_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "resource_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      role_expectations: {
        Row: {
          committee_id: string;
          expectation_text: string;
          id: string;
          role_id: string;
          updated_at: string;
        };
        Insert: {
          committee_id: string;
          expectation_text?: string;
          id?: string;
          role_id: string;
          updated_at?: string;
        };
        Update: {
          committee_id?: string;
          expectation_text?: string;
          id?: string;
          role_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_expectations_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_expectations_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "committee_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_portal: {
        Args: { search_text: string };
        Returns: {
          committee_id: string;
          entity_id: string;
          entity_type: string;
          rank: number;
          subtitle: string;
          title: string;
        }[];
      };
    };
    Enums: {
      account_status: "pending" | "active" | "suspended";
      action_priority: "low" | "medium" | "high";
      backup_status: "running" | "succeeded" | "failed";
      committee_access_level: "chair" | "staff" | "member";
      committee_status: "active" | "archived";
      global_role: "admin" | "dean" | "staff" | "faculty";
      meeting_status: "planned" | "scheduled" | "in_progress" | "completed" | "cancelled";
      person_category: "faculty" | "staff" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["pending", "active", "suspended"],
      action_priority: ["low", "medium", "high"],
      backup_status: ["running", "succeeded", "failed"],
      committee_access_level: ["chair", "staff", "member"],
      committee_status: ["active", "archived"],
      global_role: ["admin", "dean", "staff", "faculty"],
      meeting_status: ["planned", "scheduled", "in_progress", "completed", "cancelled"],
      person_category: ["faculty", "staff", "admin"],
    },
  },
} as const;

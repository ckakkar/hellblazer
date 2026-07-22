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
      bodyweight_log: {
        Row: {
          created_at: string
          date: string
          id: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      exercise: {
        Row: {
          created_at: string
          default_rep_range: string | null
          equipment: string | null
          id: string
          mechanic: string | null
          name: string
          primary_muscle: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles: Database["public"]["Enums"]["muscle_group"][]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_rep_range?: string | null
          equipment?: string | null
          id?: string
          mechanic?: string | null
          name: string
          primary_muscle: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_rep_range?: string | null
          equipment?: string | null
          id?: string
          mechanic?: string | null
          name?: string
          primary_muscle?: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          user_id?: string | null
        }
        Relationships: []
      }
      profile: {
        Row: {
          created_at: string
          tier: string | null
          tier_evaluated_at: string | null
          tier_rationale: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          tier?: string | null
          tier_evaluated_at?: string | null
          tier_rationale?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          tier?: string | null
          tier_evaluated_at?: string | null
          tier_rationale?: string | null
          user_id?: string
        }
        Relationships: []
      }
      program: {
        Row: {
          created_at: string
          duration_weeks: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_weeks?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_weeks?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      program_day: {
        Row: {
          id: string
          label: string | null
          position: number
          program_id: string
          template_id: string | null
          user_id: string
          weekday: number | null
        }
        Insert: {
          id?: string
          label?: string | null
          position?: number
          program_id: string
          template_id?: string | null
          user_id: string
          weekday?: number | null
        }
        Update: {
          id?: string
          label?: string | null
          position?: number
          program_id?: string
          template_id?: string | null
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_day_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_day_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_template"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          created_at: string
          date: string
          duration_min: number | null
          id: string
          notes: string | null
          program_id: string | null
          template_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          program_id?: string | null
          template_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          program_id?: string | null
          template_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_template"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercise: {
        Row: {
          exercise_id: string
          id: string
          note: string | null
          position: number
          session_id: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          note?: string | null
          position?: number
          session_id: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          note?: string | null
          position?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_exercise_progression"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_exercise_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_exercise_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_working_set"
            referencedColumns: ["session_id"]
          },
        ]
      }
      set: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          is_warmup: boolean
          reps: number
          rpe: number | null
          session_exercise_id: string
          set_number: number
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          is_warmup?: boolean
          reps: number
          rpe?: number | null
          session_exercise_id: string
          set_number: number
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          is_warmup?: boolean
          reps?: number
          rpe?: number | null
          session_exercise_id?: string
          set_number?: number
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "set_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "v_working_set"
            referencedColumns: ["session_exercise_id"]
          },
        ]
      }
      template_exercise: {
        Row: {
          exercise_id: string
          id: string
          note: string | null
          position: number
          target_rep_range: string | null
          target_sets: number | null
          template_id: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          note?: string | null
          position?: number
          target_rep_range?: string | null
          target_sets?: number | null
          template_id: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          note?: string | null
          position?: number
          target_rep_range?: string | null
          target_sets?: number | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercise_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercise_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_template"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template: {
        Row: {
          created_at: string
          day_label: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day_label?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day_label?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_exercise_progression: {
        Row: {
          best_est_1rm: number | null
          best_set_volume: number | null
          exercise_id: string | null
          exercise_name: string | null
          session_date: string | null
          session_id: string | null
          top_weight: number | null
          user_id: string | null
          volume: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise"
            referencedColumns: ["id"]
          },
        ]
      }
      v_session_summary: {
        Row: {
          duration_min: number | null
          exercise_count: number | null
          session_date: string | null
          session_id: string | null
          template_id: string | null
          title: string | null
          total_volume: number | null
          user_id: string | null
          working_sets: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_template"
            referencedColumns: ["id"]
          },
        ]
      }
      v_weekly_sets_per_muscle: {
        Row: {
          muscle: Database["public"]["Enums"]["muscle_group"] | null
          sets: number | null
          user_id: string | null
          volume: number | null
          week: string | null
        }
        Relationships: []
      }
      v_working_set: {
        Row: {
          est_1rm: number | null
          exercise_id: string | null
          exercise_name: string | null
          primary_muscle: Database["public"]["Enums"]["muscle_group"] | null
          reps: number | null
          rpe: number | null
          secondary_muscles:
            | Database["public"]["Enums"]["muscle_group"][]
            | null
          session_date: string | null
          session_exercise_id: string | null
          session_id: string | null
          set_id: string | null
          set_number: number | null
          user_id: string | null
          volume: number | null
          weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      muscle_group:
        | "chest"
        | "back"
        | "side_delt"
        | "rear_delt"
        | "front_delt"
        | "biceps"
        | "triceps"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "abs"
        | "forearms"
        | "traps"
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
      muscle_group: [
        "chest",
        "back",
        "side_delt",
        "rear_delt",
        "front_delt",
        "biceps",
        "triceps",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "abs",
        "forearms",
        "traps",
      ],
    },
  },
} as const

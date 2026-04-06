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
      aircraft: {
        Row: {
          aircraft_type: string
          baggage_weight_with_pax: number
          baggage_weight_without_pax: number
          basic_empty_weight: number
          cabin_attendant_weight: number
          created_at: string
          cruise_fuel_burn: number
          default_pax_weight: number
          default_pic_weight: number
          default_sic_weight: number
          id: string
          manufacturer: string
          max_fuel_capacity: number
          max_landing_weight: number
          max_ramp_weight: number
          max_takeoff_weight: number
          model: string
          nickname: string | null
          operator_id: string
          penalty_rate: number
          preferred_reserve: number
          tail_number: string
          taxi_fuel_burn: number
          updated_at: string
        }
        Insert: {
          aircraft_type?: string
          baggage_weight_with_pax?: number
          baggage_weight_without_pax?: number
          basic_empty_weight?: number
          cabin_attendant_weight?: number
          created_at?: string
          cruise_fuel_burn?: number
          default_pax_weight?: number
          default_pic_weight?: number
          default_sic_weight?: number
          id?: string
          manufacturer?: string
          max_fuel_capacity?: number
          max_landing_weight?: number
          max_ramp_weight?: number
          max_takeoff_weight?: number
          model?: string
          nickname?: string | null
          operator_id: string
          penalty_rate?: number
          preferred_reserve?: number
          tail_number: string
          taxi_fuel_burn?: number
          updated_at?: string
        }
        Update: {
          aircraft_type?: string
          baggage_weight_with_pax?: number
          baggage_weight_without_pax?: number
          basic_empty_weight?: number
          cabin_attendant_weight?: number
          created_at?: string
          cruise_fuel_burn?: number
          default_pax_weight?: number
          default_pic_weight?: number
          default_sic_weight?: number
          id?: string
          manufacturer?: string
          max_fuel_capacity?: number
          max_landing_weight?: number
          max_ramp_weight?: number
          max_takeoff_weight?: number
          model?: string
          nickname?: string | null
          operator_id?: string
          penalty_rate?: number
          preferred_reserve?: number
          tail_number?: string
          taxi_fuel_burn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          operator_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          operator_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          operator_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_invites_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          operator_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          operator_id?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          operator_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_leg_results: {
        Row: {
          created_at: string
          fuel_cost: number
          fuel_to_uplift_gallons: number
          fuel_to_uplift_lbs: number
          id: string
          landing_fuel_lbs: number
          landing_weight_lbs: number
          starting_fuel_lbs: number
          takeoff_weight_lbs: number
          total_cost: number
          trip_leg_id: string
          waived_fees: string
        }
        Insert: {
          created_at?: string
          fuel_cost?: number
          fuel_to_uplift_gallons?: number
          fuel_to_uplift_lbs?: number
          id?: string
          landing_fuel_lbs?: number
          landing_weight_lbs?: number
          starting_fuel_lbs?: number
          takeoff_weight_lbs?: number
          total_cost?: number
          trip_leg_id: string
          waived_fees?: string
        }
        Update: {
          created_at?: string
          fuel_cost?: number
          fuel_to_uplift_gallons?: number
          fuel_to_uplift_lbs?: number
          id?: string
          landing_fuel_lbs?: number
          landing_weight_lbs?: number
          starting_fuel_lbs?: number
          takeoff_weight_lbs?: number
          total_cost?: number
          trip_leg_id?: string
          waived_fees?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_leg_results_trip_leg_id_fkey"
            columns: ["trip_leg_id"]
            isOneToOne: false
            referencedRelation: "trip_legs"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_legs: {
        Row: {
          baggage_weight: number
          created_at: string
          crew_weights: Json
          departure_fee_cost: number
          departure_fee_waived_with: number
          departure_icao: string
          destination_icao: string
          fuel_burn: number
          fuel_price_tiers: Json
          id: string
          is_active: boolean
          leg_number: number
          max_landing_weight: number
          max_takeoff_weight: number
          passenger_weights: Json
          reserve: number
          taxi_fuel_burn: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          baggage_weight?: number
          created_at?: string
          crew_weights?: Json
          departure_fee_cost?: number
          departure_fee_waived_with?: number
          departure_icao?: string
          destination_icao?: string
          fuel_burn?: number
          fuel_price_tiers?: Json
          id?: string
          is_active?: boolean
          leg_number?: number
          max_landing_weight?: number
          max_takeoff_weight?: number
          passenger_weights?: Json
          reserve?: number
          taxi_fuel_burn?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          baggage_weight?: number
          created_at?: string
          crew_weights?: Json
          departure_fee_cost?: number
          departure_fee_waived_with?: number
          departure_icao?: string
          destination_icao?: string
          fuel_burn?: number
          fuel_price_tiers?: Json
          id?: string
          is_active?: boolean
          leg_number?: number
          max_landing_weight?: number
          max_takeoff_weight?: number
          passenger_weights?: Json
          reserve?: number
          taxi_fuel_burn?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_legs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          aircraft_id: string
          created_at: string
          created_by: string
          current_fuel_on_board: number
          id: string
          operator_id: string
          status: string
          total_cost: number | null
          total_savings: number | null
          trip_number: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          created_at?: string
          created_by: string
          current_fuel_on_board?: number
          id?: string
          operator_id: string
          status?: string
          total_cost?: number | null
          total_savings?: number | null
          trip_number?: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          created_at?: string
          created_by?: string
          current_fuel_on_board?: number
          id?: string
          operator_id?: string
          status?: string
          total_cost?: number | null
          total_savings?: number | null
          trip_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

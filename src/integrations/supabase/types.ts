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
      aircrafts: {
        Row: {
          basic_empty_weight: number | null
          carry_type_id: number | null
          cruise_fuel_burn: number | null
          default_baggage_no_pax: number | null
          default_baggage_with_pax: number | null
          default_cabin_weight: number | null
          default_pax_weight: number | null
          default_pic_weight: number | null
          default_sic_weight: number | null
          id: number
          is_enabled: boolean | null
          manufacturer: string | null
          max_fuel_capacity: number | null
          max_landing_weight: number | null
          max_ramp_weight: number | null
          max_takeoff_weight: number | null
          penalty_rate: number | null
          preferred_reserve: number | null
          tail_number: string
          taxi_fuel_burn: number | null
          type: string | null
          user_company: string | null
        }
        Insert: {
          basic_empty_weight?: number | null
          carry_type_id?: number | null
          cruise_fuel_burn?: number | null
          default_baggage_no_pax?: number | null
          default_baggage_with_pax?: number | null
          default_cabin_weight?: number | null
          default_pax_weight?: number | null
          default_pic_weight?: number | null
          default_sic_weight?: number | null
          id?: number
          is_enabled?: boolean | null
          manufacturer?: string | null
          max_fuel_capacity?: number | null
          max_landing_weight?: number | null
          max_ramp_weight?: number | null
          max_takeoff_weight?: number | null
          penalty_rate?: number | null
          preferred_reserve?: number | null
          tail_number?: string
          taxi_fuel_burn?: number | null
          type?: string | null
          user_company?: string | null
        }
        Update: {
          basic_empty_weight?: number | null
          carry_type_id?: number | null
          cruise_fuel_burn?: number | null
          default_baggage_no_pax?: number | null
          default_baggage_with_pax?: number | null
          default_cabin_weight?: number | null
          default_pax_weight?: number | null
          default_pic_weight?: number | null
          default_sic_weight?: number | null
          id?: number
          is_enabled?: boolean | null
          manufacturer?: string | null
          max_fuel_capacity?: number | null
          max_landing_weight?: number | null
          max_ramp_weight?: number | null
          max_takeoff_weight?: number | null
          penalty_rate?: number | null
          preferred_reserve?: number | null
          tail_number?: string
          taxi_fuel_burn?: number | null
          type?: string | null
          user_company?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircrafts_carry_type_id_fkey"
            columns: ["carry_type_id"]
            isOneToOne: false
            referencedRelation: "carry_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircrafts_user_company_fkey"
            columns: ["user_company"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      billing_email_log: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          provider_response: string | null
          recipient_email: string
          status: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          provider_response?: string | null
          recipient_email: string
          status: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          provider_response?: string | null
          recipient_email?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      carry_types: {
        Row: {
          cruise_fuel_burn: number | null
          id: number
          name: string
          penalty_rate: number | null
        }
        Insert: {
          cruise_fuel_burn?: number | null
          id?: number
          name?: string
          penalty_rate?: number | null
        }
        Update: {
          cruise_fuel_burn?: number | null
          id?: number
          name?: string
          penalty_rate?: number | null
        }
        Relationships: []
      }
      dfy_clients: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string
          created_at: string
          id: string
          monthly_rate_cents: number
          per_trip_rate_cents: number
          pricing_tier: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          monthly_rate_cents?: number
          per_trip_rate_cents?: number
          pricing_tier?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          monthly_rate_cents?: number
          per_trip_rate_cents?: number
          pricing_tier?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dfy_requests: {
        Row: {
          admin_notes: string
          client_id: string
          created_at: string
          fuel_burns: Json | null
          fuel_on_board_lbs: number | null
          id: string
          parsed_result: Json | null
          pdf_storage_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string
          client_id: string
          created_at?: string
          fuel_burns?: Json | null
          fuel_on_board_lbs?: number | null
          id?: string
          parsed_result?: Json | null
          pdf_storage_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string
          client_id?: string
          created_at?: string
          fuel_burns?: Json | null
          fuel_on_board_lbs?: number | null
          id?: string
          parsed_result?: Json | null
          pdf_storage_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dfy_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "dfy_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      dfy_usage_charges: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          description: string
          id: string
          invoice_period_end: string | null
          invoiced_at: string | null
          notes: string
          refunded_at: string | null
          request_id: string
          status: string
          stripe_invoice_item_id: string | null
          updated_at: string
          user_id: string
          voided_at: string | null
        }
        Insert: {
          amount_cents?: number
          client_id: string
          created_at?: string
          description?: string
          id?: string
          invoice_period_end?: string | null
          invoiced_at?: string | null
          notes?: string
          refunded_at?: string | null
          request_id: string
          status?: string
          stripe_invoice_item_id?: string | null
          updated_at?: string
          user_id: string
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          invoice_period_end?: string | null
          invoiced_at?: string | null
          notes?: string
          refunded_at?: string | null
          request_id?: string
          status?: string
          stripe_invoice_item_id?: string | null
          updated_at?: string
          user_id?: string
          voided_at?: string | null
        }
        Relationships: []
      }
      email_lists: {
        Row: {
          emails: Json | null
          id: number
          user_id: string | null
        }
        Insert: {
          emails?: Json | null
          id?: number
          user_id?: string | null
        }
        Update: {
          emails?: Json | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onfly_data: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          itinerary_num: string | null
          parsed_at: string
          pdf_storage_path: string | null
          raw_itinerary: Json | null
          trip_id: number | null
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          itinerary_num?: string | null
          parsed_at?: string
          pdf_storage_path?: string | null
          raw_itinerary?: Json | null
          trip_id?: number | null
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          itinerary_num?: string | null
          parsed_at?: string
          pdf_storage_path?: string | null
          raw_itinerary?: Json | null
          trip_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onfly_data_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          billing_email_preference: Database["public"]["Enums"]["billing_email_preference"]
          company: string | null
          created_on: string
          email: string
          first_name: string
          id: string
          is_billing_manager: boolean
          is_enabled: boolean | null
          last_name: string
          role_name: string | null
        }
        Insert: {
          billing_email_preference?: Database["public"]["Enums"]["billing_email_preference"]
          company?: string | null
          created_on?: string
          email: string
          first_name?: string
          id: string
          is_billing_manager?: boolean
          is_enabled?: boolean | null
          last_name?: string
          role_name?: string | null
        }
        Update: {
          billing_email_preference?: Database["public"]["Enums"]["billing_email_preference"]
          company?: string | null
          created_on?: string
          email?: string
          first_name?: string
          id?: string
          is_billing_manager?: boolean
          is_enabled?: boolean | null
          last_name?: string
          role_name?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          amount_cents: number | null
          environment: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          status: string
          stripe_customer_id: string | null
          stripe_event_id: string | null
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          environment: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          environment?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          aircraft_count: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_amount_cents: number
          pending_billing_cycle:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          quickbooks_customer_id: string | null
          quickbooks_invoice_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string
          trial_reminder_sent: boolean
          trial_starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aircraft_count?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_amount_cents?: number
          pending_billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          quickbooks_customer_id?: string | null
          quickbooks_invoice_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_reminder_sent?: boolean
          trial_starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aircraft_count?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_amount_cents?: number
          pending_billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          quickbooks_customer_id?: string | null
          quickbooks_invoice_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_reminder_sent?: boolean
          trial_starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_on: string | null
          details: Json | null
          id: number
          itinerary_details: Json | null
          itinerary_num: string | null
          savings: number | null
          user_company: string | null
        }
        Insert: {
          created_on?: string | null
          details?: Json | null
          id?: number
          itinerary_details?: Json | null
          itinerary_num?: string | null
          savings?: number | null
          user_company?: string | null
        }
        Update: {
          created_on?: string | null
          details?: Json | null
          id?: number
          itinerary_details?: Json | null
          itinerary_num?: string | null
          savings?: number | null
          user_company?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_user_company_fkey"
            columns: ["user_company"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_subscription_price: {
        Args: { plane_count: number }
        Returns: number
      }
      can_manage_billing: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_billing_exempt: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      billing_cycle: "four_weekly" | "annual"
      billing_email_preference: "all" | "critical" | "changes" | "none"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
      billing_cycle: ["four_weekly", "annual"],
      billing_email_preference: ["all", "critical", "changes", "none"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      order_audit_logs: {
        Row: {
          access_location: string | null
          access_purpose: string | null
          action: string
          client_identifier: string | null
          consent_verified: boolean | null
          created_at: string
          delivery_status: string | null
          driver_id: string | null
          geolocation: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_status: string | null
          order_id: string
          phi_fields_accessed: string[] | null
          phi_type: string | null
          previous_status: string | null
          session_id: string | null
          user_agent: string | null
          user_full_name: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          access_location?: string | null
          access_purpose?: string | null
          action: string
          client_identifier?: string | null
          consent_verified?: boolean | null
          created_at?: string
          delivery_status?: string | null
          driver_id?: string | null
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          order_id: string
          phi_fields_accessed?: string[] | null
          phi_type?: string | null
          previous_status?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_full_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          access_location?: string | null
          access_purpose?: string | null
          action?: string
          client_identifier?: string | null
          consent_verified?: boolean | null
          created_at?: string
          delivery_status?: string | null
          driver_id?: string | null
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          order_id?: string
          phi_fields_accessed?: string[] | null
          phi_type?: string | null
          previous_status?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_full_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_1: string | null
          address_2: string | null
          address_review_requested_at: string | null
          arrived_at: string | null
          assigned_at: string | null
          assigned_driver_id: string | null
          authorizing_pharmacist: string | null
          billing_date: string | null
          call_datetime: string | null
          call_notes: string | null
          city: string | null
          completed_at: string | null
          confirmed_at: string | null
          country: string | null
          created_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          dob: string | null
          doses_injectable: number | null
          doses_nasal: number | null
          driver_id_import: string | null
          email: string | null
          geo_zone: string | null
          health_card: string | null
          id: string
          in_route_at: string | null
          injection_rx: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          nasal_rx: string | null
          pending_at: string | null
          pharmacy_name: string | null
          phone_number: string | null
          picked_up_at: string | null
          postal: string | null
          province: string | null
          province_1: string | null
          review_notes: string | null
          review_reason: string | null
          review_requested_at: string | null
          ship_date: string | null
          shipment_id: string | null
          shipment_id_import: string | null
          shipped_at: string | null
          timeline_status: Database["public"]["Enums"]["timeline_status"] | null
          tracking_id: string | null
          tracking_url: string | null
          tracking_url_source: string | null
          training_status: string | null
          updated_at: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          authorizing_pharmacist?: string | null
          billing_date?: string | null
          call_datetime?: string | null
          call_notes?: string | null
          city?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          dob?: string | null
          doses_injectable?: number | null
          doses_nasal?: number | null
          driver_id_import?: string | null
          email?: string | null
          geo_zone?: string | null
          health_card?: string | null
          id?: string
          in_route_at?: string | null
          injection_rx?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nasal_rx?: string | null
          pending_at?: string | null
          pharmacy_name?: string | null
          phone_number?: string | null
          picked_up_at?: string | null
          postal?: string | null
          province?: string | null
          province_1?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          ship_date?: string | null
          shipment_id?: string | null
          shipment_id_import?: string | null
          shipped_at?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id?: string | null
          tracking_url?: string | null
          tracking_url_source?: string | null
          training_status?: string | null
          updated_at?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          authorizing_pharmacist?: string | null
          billing_date?: string | null
          call_datetime?: string | null
          call_notes?: string | null
          city?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          dob?: string | null
          doses_injectable?: number | null
          doses_nasal?: number | null
          driver_id_import?: string | null
          email?: string | null
          geo_zone?: string | null
          health_card?: string | null
          id?: string
          in_route_at?: string | null
          injection_rx?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nasal_rx?: string | null
          pending_at?: string | null
          pharmacy_name?: string | null
          phone_number?: string | null
          picked_up_at?: string | null
          postal?: string | null
          province?: string | null
          province_1?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          ship_date?: string | null
          shipment_id?: string | null
          shipment_id_import?: string | null
          shipped_at?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id?: string | null
          tracking_url?: string | null
          tracking_url_source?: string | null
          training_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agreement_data_disclosure: boolean | null
          agreement_privacy: boolean | null
          agreement_terms: boolean | null
          avatar_url: string | null
          created_at: string | null
          dob: string | null
          driver_id: string | null
          full_name: string | null
          id: string
          onboarding_status:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          phone: string | null
        }
        Insert: {
          agreement_data_disclosure?: boolean | null
          agreement_privacy?: boolean | null
          agreement_terms?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          dob?: string | null
          driver_id?: string | null
          full_name?: string | null
          id: string
          onboarding_status?:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          phone?: string | null
        }
        Update: {
          agreement_data_disclosure?: boolean | null
          agreement_privacy?: boolean | null
          agreement_terms?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          dob?: string | null
          driver_id?: string | null
          full_name?: string | null
          id?: string
          onboarding_status?:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          phone?: string | null
        }
        Relationships: []
      }
      public_tracking: {
        Row: {
          address_review_requested_at: string | null
          arrived_at: string | null
          assigned_at: string | null
          city: string | null
          client_initials: string | null
          completed_at: string | null
          confirmed_at: string | null
          country: string | null
          created_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          doses_injectable: number | null
          doses_nasal: number | null
          driver_id: string | null
          geo_zone: string | null
          id: string
          in_route_at: string | null
          injection_rx: string | null
          latitude: number | null
          longitude: number | null
          nasal_rx: string | null
          order_id: string | null
          pending_at: string | null
          picked_up_at: string | null
          postal_code: string | null
          province: string | null
          review_notes: string | null
          review_reason: string | null
          review_requested_at: string | null
          shipment_id: string | null
          shipped_at: string | null
          timeline_status: Database["public"]["Enums"]["timeline_status"] | null
          tracking_id: string
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          city?: string | null
          client_initials?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          doses_injectable?: number | null
          doses_nasal?: number | null
          driver_id?: string | null
          geo_zone?: string | null
          id?: string
          in_route_at?: string | null
          injection_rx?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_rx?: string | null
          order_id?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
          postal_code?: string | null
          province?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id: string
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          city?: string | null
          client_initials?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          doses_injectable?: number | null
          doses_nasal?: number | null
          driver_id?: string | null
          geo_zone?: string | null
          id?: string
          in_route_at?: string | null
          injection_rx?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_rx?: string | null
          order_id?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
          postal_code?: string | null
          province?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id?: string
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_tracking_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_driver_id: { Args: never; Returns: string }
      generate_shipment_id: { Args: never; Returns: string }
      generate_tracking_id: { Args: never; Returns: string }
      get_client_initials: { Args: { full_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "pharmacy_admin" | "driver"
      delivery_status:
        | "SUCCESSFULLY_DELIVERED"
        | "PACKAGE_DELIVERED_TO_CLIENT"
        | "CLIENT_UNAVAILABLE"
        | "NO_ONE_HOME"
        | "WRONG_ADDRESS"
        | "ADDRESS_INCORRECT"
        | "SAFETY_CONCERN"
        | "UNSAFE_LOCATION"
        | "OTHER"
      onboarding_status: "not_started" | "in_progress" | "completed"
      timeline_status:
        | "PENDING"
        | "PICKED_UP_AND_ASSIGNED"
        | "REVIEW_REQUESTED"
        | "CONFIRMED"
        | "IN_ROUTE"
        | "ARRIVED"
        | "COMPLETED_DELIVERED"
        | "COMPLETED_INCOMPLETE"
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
      app_role: ["pharmacy_admin", "driver"],
      delivery_status: [
        "SUCCESSFULLY_DELIVERED",
        "PACKAGE_DELIVERED_TO_CLIENT",
        "CLIENT_UNAVAILABLE",
        "NO_ONE_HOME",
        "WRONG_ADDRESS",
        "ADDRESS_INCORRECT",
        "SAFETY_CONCERN",
        "UNSAFE_LOCATION",
        "OTHER",
      ],
      onboarding_status: ["not_started", "in_progress", "completed"],
      timeline_status: [
        "PENDING",
        "PICKED_UP_AND_ASSIGNED",
        "REVIEW_REQUESTED",
        "CONFIRMED",
        "IN_ROUTE",
        "ARRIVED",
        "COMPLETED_DELIVERED",
        "COMPLETED_INCOMPLETE",
      ],
    },
  },
} as const

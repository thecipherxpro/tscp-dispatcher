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
      admin_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      custom_orders: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          authorizing_doctor_name: string | null
          client_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          geo_zone: string | null
          health_card_no: string | null
          id: string
          injection_billing_date: string | null
          injection_din: string | null
          injection_drug_name: string | null
          injection_form: string | null
          injection_package: string | null
          injection_qty: number | null
          injection_rx_number: string | null
          injection_strength: string | null
          label_delivered_at: string | null
          label_shipped_at: string | null
          label_status: string | null
          latitude: number | null
          longitude: number | null
          nasal_billing_date: string | null
          nasal_din: string | null
          nasal_drug_name: string | null
          nasal_package: string | null
          nasal_qty: number | null
          nasal_rx_number: string | null
          notes: string | null
          order_date: string | null
          shipment_id: string | null
          shipping_date: string | null
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string | null
          warehouse_address: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          authorizing_doctor_name?: string | null
          client_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          geo_zone?: string | null
          health_card_no?: string | null
          id?: string
          injection_billing_date?: string | null
          injection_din?: string | null
          injection_drug_name?: string | null
          injection_form?: string | null
          injection_package?: string | null
          injection_qty?: number | null
          injection_rx_number?: string | null
          injection_strength?: string | null
          label_delivered_at?: string | null
          label_shipped_at?: string | null
          label_status?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_billing_date?: string | null
          nasal_din?: string | null
          nasal_drug_name?: string | null
          nasal_package?: string | null
          nasal_qty?: number | null
          nasal_rx_number?: string | null
          notes?: string | null
          order_date?: string | null
          shipment_id?: string | null
          shipping_date?: string | null
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          authorizing_doctor_name?: string | null
          client_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          geo_zone?: string | null
          health_card_no?: string | null
          id?: string
          injection_billing_date?: string | null
          injection_din?: string | null
          injection_drug_name?: string | null
          injection_form?: string | null
          injection_package?: string | null
          injection_qty?: number | null
          injection_rx_number?: string | null
          injection_strength?: string | null
          label_delivered_at?: string | null
          label_shipped_at?: string | null
          label_status?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_billing_date?: string | null
          nasal_din?: string | null
          nasal_drug_name?: string | null
          nasal_package?: string | null
          nasal_qty?: number | null
          nasal_rx_number?: string | null
          notes?: string | null
          order_date?: string | null
          shipment_id?: string | null
          shipping_date?: string | null
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          base_rate: number
          completed_at: string
          created_at: string | null
          distance_earnings: number
          distance_km: number
          driver_id: string
          id: string
          order_id: string
          payout_period_end: string | null
          payout_period_start: string | null
          payout_status: string | null
          per_km_rate: number
          shipment_id: string | null
          total_earnings: number
        }
        Insert: {
          base_rate?: number
          completed_at: string
          created_at?: string | null
          distance_earnings?: number
          distance_km?: number
          driver_id: string
          id?: string
          order_id: string
          payout_period_end?: string | null
          payout_period_start?: string | null
          payout_status?: string | null
          per_km_rate?: number
          shipment_id?: string | null
          total_earnings?: number
        }
        Update: {
          base_rate?: number
          completed_at?: string
          created_at?: string | null
          distance_earnings?: number
          distance_km?: number
          driver_id?: string
          id?: string
          order_id?: string
          payout_period_end?: string | null
          payout_period_start?: string | null
          payout_status?: string | null
          per_km_rate?: number
          shipment_id?: string | null
          total_earnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_pay_stubs: {
        Row: {
          driver_id: string
          generated_at: string | null
          id: string
          is_auto_generated: boolean | null
          period_end: string
          period_start: string
          stub_data: Json | null
          total_distance_km: number | null
          total_earnings: number | null
          total_orders: number | null
        }
        Insert: {
          driver_id: string
          generated_at?: string | null
          id?: string
          is_auto_generated?: boolean | null
          period_end: string
          period_start: string
          stub_data?: Json | null
          total_distance_km?: number | null
          total_earnings?: number | null
          total_orders?: number | null
        }
        Update: {
          driver_id?: string
          generated_at?: string | null
          id?: string
          is_auto_generated?: boolean | null
          period_end?: string
          period_start?: string
          stub_data?: Json | null
          total_distance_km?: number | null
          total_earnings?: number | null
          total_orders?: number | null
        }
        Relationships: []
      }
      driver_payout_settings: {
        Row: {
          account_number: string | null
          auto_deposit: boolean | null
          bank_name: string | null
          created_at: string | null
          driver_id: string
          e_transfer_email: string | null
          first_order_completed_at: string | null
          id: string
          institution_name: string | null
          institution_number: string | null
          legal_name: string | null
          payout_method: string | null
          security_answer: string | null
          security_question: string | null
          transit_number: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          auto_deposit?: boolean | null
          bank_name?: string | null
          created_at?: string | null
          driver_id: string
          e_transfer_email?: string | null
          first_order_completed_at?: string | null
          id?: string
          institution_name?: string | null
          institution_number?: string | null
          legal_name?: string | null
          payout_method?: string | null
          security_answer?: string | null
          security_question?: string | null
          transit_number?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          auto_deposit?: boolean | null
          bank_name?: string | null
          created_at?: string | null
          driver_id?: string
          e_transfer_email?: string | null
          first_order_completed_at?: string | null
          id?: string
          institution_name?: string | null
          institution_number?: string | null
          legal_name?: string | null
          payout_method?: string | null
          security_answer?: string | null
          security_question?: string | null
          transit_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      drug_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          drug_type_key: string
          field_schema: Json
          id: string
          is_active: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          drug_type_key: string
          field_schema?: Json
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          drug_type_key?: string
          field_schema?: Json
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_templates: {
        Row: {
          column_mappings: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          drug_type_mappings: Json
          id: string
          is_default: boolean | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          column_mappings?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drug_type_mappings?: Json
          id?: string
          is_default?: boolean | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          column_mappings?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drug_type_mappings?: Json
          id?: string
          is_default?: boolean | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_audit_logs: {
        Row: {
          access_location: string | null
          access_purpose: string | null
          action: string
          client_identifier: string | null
          consent_verified: boolean | null
          created_at: string
          delivery_route_snapshot_url: string | null
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
          delivery_route_snapshot_url?: string | null
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
          delivery_route_snapshot_url?: string | null
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
          address_line_1: string | null
          address_line_2: string | null
          address_review_requested_at: string | null
          arrived_at: string | null
          assigned_at: string | null
          assigned_driver_id: string | null
          authorizing_doctor_name: string | null
          client_name: string | null
          completed_at: string | null
          confirmed_at: string | null
          country: string | null
          created_at: string | null
          delivery_distance_km: number | null
          delivery_route_snapshot_status: string | null
          delivery_route_snapshot_url: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          email: string | null
          geo_zone: string | null
          health_card_no: string | null
          id: string
          in_route_at: string | null
          injection_billing_date: string | null
          injection_din: string | null
          injection_drug_name: string | null
          injection_form: string | null
          injection_package: string | null
          injection_qty: number | null
          injection_rx_number: string | null
          injection_strength: string | null
          latitude: number | null
          longitude: number | null
          nasal_billing_date: string | null
          nasal_din: string | null
          nasal_drug_name: string | null
          nasal_package: string | null
          nasal_qty: number | null
          nasal_rx_number: string | null
          notes: string | null
          order_date: string | null
          pending_at: string | null
          picked_up_at: string | null
          review_notes: string | null
          review_reason: string | null
          review_requested_at: string | null
          shipment_id: string | null
          shipped_at: string | null
          shipping_date: string | null
          timeline_status: Database["public"]["Enums"]["timeline_status"] | null
          tracking_id: string | null
          tracking_url: string | null
          updated_at: string | null
          warehouse_address: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          authorizing_doctor_name?: string | null
          client_name?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_distance_km?: number | null
          delivery_route_snapshot_status?: string | null
          delivery_route_snapshot_url?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          email?: string | null
          geo_zone?: string | null
          health_card_no?: string | null
          id?: string
          in_route_at?: string | null
          injection_billing_date?: string | null
          injection_din?: string | null
          injection_drug_name?: string | null
          injection_form?: string | null
          injection_package?: string | null
          injection_qty?: number | null
          injection_rx_number?: string | null
          injection_strength?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_billing_date?: string | null
          nasal_din?: string | null
          nasal_drug_name?: string | null
          nasal_package?: string | null
          nasal_qty?: number | null
          nasal_rx_number?: string | null
          notes?: string | null
          order_date?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          shipping_date?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          authorizing_doctor_name?: string | null
          client_name?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_distance_km?: number | null
          delivery_route_snapshot_status?: string | null
          delivery_route_snapshot_url?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          email?: string | null
          geo_zone?: string | null
          health_card_no?: string | null
          id?: string
          in_route_at?: string | null
          injection_billing_date?: string | null
          injection_din?: string | null
          injection_drug_name?: string | null
          injection_form?: string | null
          injection_package?: string | null
          injection_qty?: number | null
          injection_rx_number?: string | null
          injection_strength?: string | null
          latitude?: number | null
          longitude?: number | null
          nasal_billing_date?: string | null
          nasal_din?: string | null
          nasal_drug_name?: string | null
          nasal_package?: string | null
          nasal_qty?: number | null
          nasal_rx_number?: string | null
          notes?: string | null
          order_date?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
          review_notes?: string | null
          review_reason?: string | null
          review_requested_at?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          shipping_date?: string | null
          timeline_status?:
            | Database["public"]["Enums"]["timeline_status"]
            | null
          tracking_id?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
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
          client_initials: string | null
          completed_at: string | null
          confirmed_at: string | null
          country: string | null
          created_at: string | null
          delivery_route_snapshot_status: string | null
          delivery_route_snapshot_url: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          driver_id: string | null
          geo_zone: string | null
          id: string
          in_route_at: string | null
          injection_qty: number | null
          latitude: number | null
          longitude: number | null
          nasal_qty: number | null
          order_id: string | null
          pending_at: string | null
          picked_up_at: string | null
          review_notes: string | null
          review_reason: string | null
          review_requested_at: string | null
          shipment_id: string | null
          shipped_at: string | null
          timeline_status: Database["public"]["Enums"]["timeline_status"] | null
          tracking_id: string
          tracking_url: string | null
          updated_at: string | null
          warehouse_city: string | null
        }
        Insert: {
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          client_initials?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_route_snapshot_status?: string | null
          delivery_route_snapshot_url?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          driver_id?: string | null
          geo_zone?: string | null
          id?: string
          in_route_at?: string | null
          injection_qty?: number | null
          latitude?: number | null
          longitude?: number | null
          nasal_qty?: number | null
          order_id?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
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
          warehouse_city?: string | null
        }
        Update: {
          address_review_requested_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          client_initials?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          country?: string | null
          created_at?: string | null
          delivery_route_snapshot_status?: string | null
          delivery_route_snapshot_url?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          driver_id?: string | null
          geo_zone?: string | null
          id?: string
          in_route_at?: string | null
          injection_qty?: number | null
          latitude?: number | null
          longitude?: number | null
          nasal_qty?: number | null
          order_id?: string | null
          pending_at?: string | null
          picked_up_at?: string | null
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
          warehouse_city?: string | null
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
      standard_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
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

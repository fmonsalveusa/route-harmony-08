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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      dispatchers: {
        Row: {
          commission_percentage: number
          created_at: string
          dispatch_service_percentage: number
          email: string
          id: string
          name: string
          pay_type: string
          phone: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_percentage?: number
          created_at?: string
          dispatch_service_percentage?: number
          email: string
          id?: string
          name: string
          pay_type?: string
          phone: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          dispatch_service_percentage?: number
          email?: string
          id?: string
          name?: string
          pay_type?: string
          phone?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          dispatcher_id: string | null
          earnings_this_month: number | null
          email: string
          form_w9_url: string | null
          hire_date: string
          id: string
          investor_name: string | null
          investor_pay_percentage: number | null
          leasing_agreement_url: string | null
          license: string
          license_expiry: string | null
          license_photo_url: string | null
          loads_this_month: number | null
          medical_card_expiry: string | null
          medical_card_photo_url: string | null
          name: string
          pay_percentage: number
          phone: string
          service_agreement_url: string | null
          service_type: string
          status: string
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatcher_id?: string | null
          earnings_this_month?: number | null
          email: string
          form_w9_url?: string | null
          hire_date?: string
          id?: string
          investor_name?: string | null
          investor_pay_percentage?: number | null
          leasing_agreement_url?: string | null
          license: string
          license_expiry?: string | null
          license_photo_url?: string | null
          loads_this_month?: number | null
          medical_card_expiry?: string | null
          medical_card_photo_url?: string | null
          name: string
          pay_percentage?: number
          phone: string
          service_agreement_url?: string | null
          service_type?: string
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatcher_id?: string | null
          earnings_this_month?: number | null
          email?: string
          form_w9_url?: string | null
          hire_date?: string
          id?: string
          investor_name?: string | null
          investor_pay_percentage?: number | null
          leasing_agreement_url?: string | null
          license?: string
          license_expiry?: string | null
          license_photo_url?: string | null
          loads_this_month?: number | null
          medical_card_expiry?: string | null
          medical_card_photo_url?: string | null
          name?: string
          pay_percentage?: number
          phone?: string
          service_agreement_url?: string | null
          service_type?: string
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      load_stops: {
        Row: {
          address: string
          created_at: string
          date: string | null
          distance_from_prev: number | null
          id: string
          lat: number | null
          lng: number | null
          load_id: string
          stop_order: number
          stop_type: string
        }
        Insert: {
          address: string
          created_at?: string
          date?: string | null
          distance_from_prev?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          load_id: string
          stop_order?: number
          stop_type: string
        }
        Update: {
          address?: string
          created_at?: string
          date?: string | null
          distance_from_prev?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          load_id?: string
          stop_order?: number
          stop_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_stops_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          broker_client: string | null
          cargo_type: string | null
          company_profit: number | null
          created_at: string
          delivery_date: string | null
          destination: string
          dispatcher_id: string | null
          dispatcher_pay_amount: number | null
          driver_id: string | null
          driver_pay_amount: number | null
          factoring: string | null
          id: string
          investor_pay_amount: number | null
          miles: number | null
          notes: string | null
          origin: string
          pdf_url: string | null
          pickup_date: string | null
          reference_number: string
          route_geometry: Json | null
          status: string
          total_rate: number
          truck_id: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          broker_client?: string | null
          cargo_type?: string | null
          company_profit?: number | null
          created_at?: string
          delivery_date?: string | null
          destination: string
          dispatcher_id?: string | null
          dispatcher_pay_amount?: number | null
          driver_id?: string | null
          driver_pay_amount?: number | null
          factoring?: string | null
          id?: string
          investor_pay_amount?: number | null
          miles?: number | null
          notes?: string | null
          origin: string
          pdf_url?: string | null
          pickup_date?: string | null
          reference_number: string
          route_geometry?: Json | null
          status?: string
          total_rate?: number
          truck_id?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          broker_client?: string | null
          cargo_type?: string | null
          company_profit?: number | null
          created_at?: string
          delivery_date?: string | null
          destination?: string
          dispatcher_id?: string | null
          dispatcher_pay_amount?: number | null
          driver_id?: string | null
          driver_pay_amount?: number | null
          factoring?: string | null
          id?: string
          investor_pay_amount?: number | null
          miles?: number | null
          notes?: string | null
          origin?: string
          pdf_url?: string | null
          pickup_date?: string | null
          reference_number?: string
          route_geometry?: Json | null
          status?: string
          total_rate?: number
          truck_id?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          load_id: string
          load_reference: string
          payment_date: string | null
          percentage_applied: number
          recipient_id: string
          recipient_name: string
          recipient_type: string
          status: string
          total_rate: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          load_id: string
          load_reference: string
          payment_date?: string | null
          percentage_applied?: number
          recipient_id: string
          recipient_name: string
          recipient_type: string
          status?: string
          total_rate?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          load_id?: string
          load_reference?: string
          payment_date?: string | null
          percentage_applied?: number
          recipient_id?: string
          recipient_name?: string
          recipient_type?: string
          status?: string
          total_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_documents: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          load_id: string
          stop_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          load_id: string
          stop_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          load_id?: string
          stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_documents_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "load_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          cargo_area_photo_url: string | null
          cargo_height_in: number | null
          cargo_length_ft: number | null
          cargo_width_in: number | null
          created_at: string
          driver_id: string | null
          id: string
          insurance_expiry: string | null
          insurance_photo_url: string | null
          investor_id: string | null
          license_photo_url: string | null
          license_plate: string | null
          make: string | null
          max_payload_lbs: number | null
          mega_ramp: string | null
          model: string | null
          rear_door_height_in: number | null
          rear_door_width_in: number | null
          rear_truck_photo_url: string | null
          registration_expiry: string | null
          registration_photo_url: string | null
          status: string
          trailer_length_ft: number | null
          truck_plate_photo_url: string | null
          truck_side_photo_url: string | null
          truck_type: string
          unit_number: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          cargo_area_photo_url?: string | null
          cargo_height_in?: number | null
          cargo_length_ft?: number | null
          cargo_width_in?: number | null
          created_at?: string
          driver_id?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_photo_url?: string | null
          investor_id?: string | null
          license_photo_url?: string | null
          license_plate?: string | null
          make?: string | null
          max_payload_lbs?: number | null
          mega_ramp?: string | null
          model?: string | null
          rear_door_height_in?: number | null
          rear_door_width_in?: number | null
          rear_truck_photo_url?: string | null
          registration_expiry?: string | null
          registration_photo_url?: string | null
          status?: string
          trailer_length_ft?: number | null
          truck_plate_photo_url?: string | null
          truck_side_photo_url?: string | null
          truck_type?: string
          unit_number: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          cargo_area_photo_url?: string | null
          cargo_height_in?: number | null
          cargo_length_ft?: number | null
          cargo_width_in?: number | null
          created_at?: string
          driver_id?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_photo_url?: string | null
          investor_id?: string | null
          license_photo_url?: string | null
          license_plate?: string | null
          make?: string | null
          max_payload_lbs?: number | null
          mega_ramp?: string | null
          model?: string | null
          rear_door_height_in?: number | null
          rear_door_width_in?: number | null
          rear_truck_photo_url?: string | null
          registration_expiry?: string | null
          registration_photo_url?: string | null
          status?: string
          trailer_length_ft?: number | null
          truck_plate_photo_url?: string | null
          truck_side_photo_url?: string | null
          truck_type?: string
          unit_number?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
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

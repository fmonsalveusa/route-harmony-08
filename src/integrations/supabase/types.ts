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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      broker_credit_scores: {
        Row: {
          broker_name: string
          created_at: string
          days_to_pay: number | null
          id: string
          mc_number: string | null
          notes: string | null
          rating: string | null
          score: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          days_to_pay?: number | null
          id?: string
          mc_number?: string | null
          notes?: string | null
          rating?: string | null
          score?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          days_to_pay?: number | null
          id?: string
          mc_number?: string | null
          notes?: string | null
          rating?: string | null
          score?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_credit_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          address: string | null
          created_at: string
          days_to_pay: number | null
          dot_number: string | null
          id: string
          loads_count: number
          mc_number: string | null
          name: string
          notes: string | null
          rating: string | null
          score: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          days_to_pay?: number | null
          dot_number?: string | null
          id?: string
          loads_count?: number
          mc_number?: string | null
          name: string
          notes?: string | null
          rating?: string | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          days_to_pay?: number | null
          dot_number?: string | null
          id?: string
          loads_count?: number
          mc_number?: string | null
          name?: string
          notes?: string | null
          rating?: string | null
          score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          dot_number: string | null
          email: string | null
          id: string
          is_primary: boolean
          leasing_agreement_active: boolean | null
          legal_name: string | null
          logo_url: string | null
          mc_number: string | null
          name: string
          phone: string | null
          state: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          dot_number?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          leasing_agreement_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          mc_number?: string | null
          name: string
          phone?: string | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          dot_number?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          leasing_agreement_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          mc_number?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_search_status: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          is_manual: boolean
          search_date: string
          status: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          is_manual?: boolean
          search_date?: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          is_manual?: boolean
          search_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      dispatch_service_clients: {
        Row: {
          address: string | null
          agreement_signed_at: string | null
          city: string | null
          created_at: string
          dba: string | null
          dispatch_service_agreement_url: string | null
          dot_number: string | null
          ein: string | null
          email: string | null
          email_password: string | null
          factoring_company_name: string | null
          factoring_password: string | null
          factoring_username: string | null
          highway_phone: string | null
          id: string
          insurance_cert_url: string | null
          insurance_company_name: string | null
          insurance_expiry_date: string | null
          insurance_policy_number: string | null
          legal_business_name: string
          mc_authority_url: string | null
          mc_number: string | null
          noa_url: string | null
          owner_full_name: string | null
          phone: string | null
          state: string | null
          tenant_id: string
          updated_at: string
          w9_url: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          agreement_signed_at?: string | null
          city?: string | null
          created_at?: string
          dba?: string | null
          dispatch_service_agreement_url?: string | null
          dot_number?: string | null
          ein?: string | null
          email?: string | null
          email_password?: string | null
          factoring_company_name?: string | null
          factoring_password?: string | null
          factoring_username?: string | null
          highway_phone?: string | null
          id?: string
          insurance_cert_url?: string | null
          insurance_company_name?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          legal_business_name: string
          mc_authority_url?: string | null
          mc_number?: string | null
          noa_url?: string | null
          owner_full_name?: string | null
          phone?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string
          w9_url?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          agreement_signed_at?: string | null
          city?: string | null
          created_at?: string
          dba?: string | null
          dispatch_service_agreement_url?: string | null
          dot_number?: string | null
          ein?: string | null
          email?: string | null
          email_password?: string | null
          factoring_company_name?: string | null
          factoring_password?: string | null
          factoring_username?: string | null
          highway_phone?: string | null
          id?: string
          insurance_cert_url?: string | null
          insurance_company_name?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          legal_business_name?: string
          mc_authority_url?: string | null
          mc_number?: string | null
          noa_url?: string | null
          owner_full_name?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string
          w9_url?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      dispatch_service_invoices: {
        Row: {
          created_at: string
          driver_id: string
          driver_name: string
          id: string
          invoice_number: string
          loads: Json
          notes: string | null
          percentage_applied: number
          period_from: string | null
          period_to: string | null
          status: string
          tenant_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          driver_name: string
          id?: string
          invoice_number: string
          loads?: Json
          notes?: string | null
          percentage_applied?: number
          period_from?: string | null
          period_to?: string | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          driver_name?: string
          id?: string
          invoice_number?: string
          loads?: Json
          notes?: string | null
          percentage_applied?: number
          period_from?: string | null
          period_to?: string | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_service_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatcher_payment_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          load_id: string
          load_reference: string
          payment_id: string
          percentage_applied: number
          tenant_id: string | null
          total_rate: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          load_id: string
          load_reference: string
          payment_id: string
          percentage_applied?: number
          tenant_id?: string | null
          total_rate?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          load_id?: string
          load_reference?: string
          payment_id?: string
          percentage_applied?: number
          tenant_id?: string | null
          total_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatcher_payment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatchers: {
        Row: {
          color: string | null
          commission_2_percentage: number
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
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          commission_2_percentage?: number
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
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          commission_2_percentage?: number
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatchers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: number
          expires_at: number
          fields: Json
          file_data: string
          file_name: string
          id: string
          recipient_email: string | null
          signed_at: number | null
          signed_file_data: string | null
          signer_data: Json | null
          signer_name: string | null
          status: string
        }
        Insert: {
          created_at?: number
          expires_at: number
          fields?: Json
          file_data: string
          file_name: string
          id?: string
          recipient_email?: string | null
          signed_at?: number | null
          signed_file_data?: string | null
          signer_data?: Json | null
          signer_name?: string | null
          status?: string
        }
        Update: {
          created_at?: number
          expires_at?: number
          fields?: Json
          file_data?: string
          file_name?: string
          id?: string
          recipient_email?: string | null
          signed_at?: number | null
          signed_file_data?: string | null
          signer_data?: Json | null
          signer_name?: string | null
          status?: string
        }
        Relationships: []
      }
      driver_investors: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          investor_email: string | null
          investor_id: string | null
          investor_name: string
          is_active: boolean
          pay_percentage: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          investor_email?: string | null
          investor_id?: string | null
          investor_name: string
          is_active?: boolean
          pay_percentage?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          investor_email?: string | null
          investor_id?: string | null
          investor_name?: string
          is_active?: boolean
          pay_percentage?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_investors_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_investors_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_leasing_agreements: {
        Row: {
          company_id: string | null
          company_name: string
          created_at: string | null
          driver_id: string
          file_url: string
          id: string
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          company_name: string
          created_at?: string | null
          driver_id: string
          file_url: string
          id?: string
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          company_name?: string
          created_at?: string | null
          driver_id?: string
          file_url?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_leasing_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_leasing_agreements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          source: string
          speed: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          source?: string
          speed?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          source?: string
          speed?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_type: string | null
          address: string | null
          bank_name: string | null
          birthday: string | null
          city: string | null
          created_at: string
          dispatch_service_client_id: string | null
          dispatch_service_percentage: number
          dispatcher_id: string | null
          earnings_this_month: number | null
          email: string
          emergency_contact_name: string | null
          emergency_phone: string | null
          employment_contract_url: string | null
          factoring_percentage: number
          form_w9_url: string | null
          hide_payments: boolean
          hire_date: string
          id: string
          investor_email: string | null
          investor_id: string | null
          investor_name: string | null
          investor_pay_percentage: number | null
          is_paused: boolean
          leasing_agreement_58_url: string | null
          leasing_agreement_url: string | null
          leasing_agreement_venco_url: string | null
          license: string
          license_expiry: string | null
          license_photo_url: string | null
          loads_this_month: number | null
          manual_location_address: string | null
          manual_location_lat: number | null
          manual_location_lng: number | null
          medical_card_expiry: string | null
          medical_card_photo_url: string | null
          name: string
          pay_percentage: number
          phone: string
          routing_number: string | null
          service_agreement_url: string | null
          service_type: string
          state: string | null
          status: string
          tenant_id: string | null
          termination_letter_url: string | null
          truck_id: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name?: string | null
          birthday?: string | null
          city?: string | null
          created_at?: string
          dispatch_service_client_id?: string | null
          dispatch_service_percentage?: number
          dispatcher_id?: string | null
          earnings_this_month?: number | null
          email: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          employment_contract_url?: string | null
          factoring_percentage?: number
          form_w9_url?: string | null
          hide_payments?: boolean
          hire_date?: string
          id?: string
          investor_email?: string | null
          investor_id?: string | null
          investor_name?: string | null
          investor_pay_percentage?: number | null
          is_paused?: boolean
          leasing_agreement_58_url?: string | null
          leasing_agreement_url?: string | null
          leasing_agreement_venco_url?: string | null
          license: string
          license_expiry?: string | null
          license_photo_url?: string | null
          loads_this_month?: number | null
          manual_location_address?: string | null
          manual_location_lat?: number | null
          manual_location_lng?: number | null
          medical_card_expiry?: string | null
          medical_card_photo_url?: string | null
          name: string
          pay_percentage?: number
          phone: string
          routing_number?: string | null
          service_agreement_url?: string | null
          service_type?: string
          state?: string | null
          status?: string
          tenant_id?: string | null
          termination_letter_url?: string | null
          truck_id?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name?: string | null
          birthday?: string | null
          city?: string | null
          created_at?: string
          dispatch_service_client_id?: string | null
          dispatch_service_percentage?: number
          dispatcher_id?: string | null
          earnings_this_month?: number | null
          email?: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          employment_contract_url?: string | null
          factoring_percentage?: number
          form_w9_url?: string | null
          hide_payments?: boolean
          hire_date?: string
          id?: string
          investor_email?: string | null
          investor_id?: string | null
          investor_name?: string | null
          investor_pay_percentage?: number | null
          is_paused?: boolean
          leasing_agreement_58_url?: string | null
          leasing_agreement_url?: string | null
          leasing_agreement_venco_url?: string | null
          license?: string
          license_expiry?: string | null
          license_photo_url?: string | null
          loads_this_month?: number | null
          manual_location_address?: string | null
          manual_location_lat?: number | null
          manual_location_lng?: number | null
          medical_card_expiry?: string | null
          medical_card_photo_url?: string | null
          name?: string
          pay_percentage?: number
          phone?: string
          routing_number?: string | null
          service_agreement_url?: string | null
          service_type?: string
          state?: string | null
          status?: string
          tenant_id?: string | null
          termination_letter_url?: string | null
          truck_id?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_dispatch_service_client_id_fkey"
            columns: ["dispatch_service_client_id"]
            isOneToOne: false
            referencedRelation: "dispatch_service_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eld_accounts: {
        Row: {
          api_password_encrypted: string | null
          api_user: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_password_encrypted?: string | null
          api_user: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_password_encrypted?: string | null
          api_user?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eld_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eld_driver_data: {
        Row: {
          created_at: string | null
          driver_id: string | null
          duty_status: string | null
          duty_updated_at: string | null
          gps_updated_at: string | null
          heading: number | null
          hos_updated_at: string | null
          hours_remaining_today: number | null
          hours_remaining_week: number | null
          id: string
          lat: number | null
          lng: number | null
          odometer: number | null
          odometer_updated_at: string | null
          speed_mph: number | null
          tenant_id: string
          truck_id: string | null
          truck_vin: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          duty_status?: string | null
          duty_updated_at?: string | null
          gps_updated_at?: string | null
          heading?: number | null
          hos_updated_at?: string | null
          hours_remaining_today?: number | null
          hours_remaining_week?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          odometer?: number | null
          odometer_updated_at?: string | null
          speed_mph?: number | null
          tenant_id: string
          truck_id?: string | null
          truck_vin: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          duty_status?: string | null
          duty_updated_at?: string | null
          gps_updated_at?: string | null
          heading?: number | null
          hos_updated_at?: string | null
          hours_remaining_today?: number | null
          hours_remaining_week?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          odometer?: number | null
          odometer_updated_at?: string | null
          speed_mph?: number | null
          tenant_id?: string
          truck_id?: string | null
          truck_vin?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eld_driver_data_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eld_driver_data_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      eld_vehicle_map: {
        Row: {
          created_at: string
          driver_id: string | null
          eld_account_id: string
          eld_vehicle_id: string
          eld_vehicle_name: string | null
          id: string
          is_active: boolean
          tenant_id: string
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          eld_account_id: string
          eld_vehicle_id: string
          eld_vehicle_name?: string | null
          id?: string
          is_active?: boolean
          tenant_id: string
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          eld_account_id?: string
          eld_vehicle_id?: string
          eld_vehicle_name?: string | null
          id?: string
          is_active?: boolean
          tenant_id?: string
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eld_vehicle_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string | null
          id: string
          keywords: string[] | null
          label: string
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          label: string
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          label?: string
          tenant_id?: string | null
          value?: string
        }
        Relationships: []
      }
      expense_receipts: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          driver_name: string | null
          driver_service_type: string | null
          expense_date: string
          expense_type: string
          id: string
          invoice_number: string | null
          location: string | null
          notes: string | null
          odometer_reading: number | null
          payment_method: string
          source: string
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          truck_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          driver_name?: string | null
          driver_service_type?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          invoice_number?: string | null
          location?: string | null
          notes?: string | null
          odometer_reading?: number | null
          payment_method?: string
          source?: string
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          truck_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          driver_name?: string | null
          driver_service_type?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          invoice_number?: string | null
          location?: string | null
          notes?: string | null
          odometer_reading?: number | null
          payment_method?: string
          source?: string
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          truck_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_type: string | null
          address: string | null
          bank_name: string | null
          business_name: string | null
          city: string | null
          created_at: string
          ein: string | null
          email: string | null
          id: string
          leasing_agreement_url: string | null
          name: string
          notes: string | null
          pay_percentage: number
          phone: string | null
          routing_number: string | null
          service_agreement_url: string | null
          ssn_last4: string | null
          state: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string
          w9_url: string | null
          zip: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          ein?: string | null
          email?: string | null
          id?: string
          leasing_agreement_url?: string | null
          name: string
          notes?: string | null
          pay_percentage?: number
          phone?: string | null
          routing_number?: string | null
          service_agreement_url?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
          w9_url?: string | null
          zip?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          ein?: string | null
          email?: string | null
          id?: string
          leasing_agreement_url?: string | null
          name?: string
          notes?: string | null
          pay_percentage?: number
          phone?: string | null
          routing_number?: string | null
          service_agreement_url?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
          w9_url?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          broker_name: string
          company_id: string | null
          company_name: string | null
          created_at: string
          id: string
          invoice_number: string
          load_id: string
          notes: string | null
          pdf_url: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          broker_name: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          invoice_number: string
          load_id: string
          notes?: string | null
          pdf_url?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          broker_name?: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          invoice_number?: string
          load_id?: string
          notes?: string | null
          pdf_url?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      load_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          apply_to: string[]
          created_at: string
          description: string | null
          id: string
          load_id: string
          reason: string
          tenant_id: string | null
        }
        Insert: {
          adjustment_type?: string
          amount?: number
          apply_to?: string[]
          created_at?: string
          description?: string | null
          id?: string
          load_id: string
          reason?: string
          tenant_id?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          apply_to?: string[]
          created_at?: string
          description?: string | null
          id?: string
          load_id?: string
          reason?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      load_stops: {
        Row: {
          address: string
          arrived_at: string | null
          consignee: string | null
          created_at: string
          date: string | null
          distance_from_prev: number | null
          id: string
          lat: number | null
          lng: number | null
          load_id: string
          photos: string[] | null
          shipper: string | null
          stop_order: number
          stop_type: string
          tenant_id: string | null
          time: string | null
        }
        Insert: {
          address: string
          arrived_at?: string | null
          consignee?: string | null
          created_at?: string
          date?: string | null
          distance_from_prev?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          load_id: string
          photos?: string[] | null
          shipper?: string | null
          stop_order?: number
          stop_type: string
          tenant_id?: string | null
          time?: string | null
        }
        Update: {
          address?: string
          arrived_at?: string | null
          consignee?: string | null
          created_at?: string
          date?: string | null
          distance_from_prev?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          load_id?: string
          photos?: string[] | null
          shipper?: string | null
          stop_order?: number
          stop_type?: string
          tenant_id?: string | null
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_stops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          bol_url: string | null
          broker_client: string | null
          cargo_type: string | null
          company_id: string | null
          company_profit: number | null
          created_at: string
          delivery_date: string | null
          delivery_time: string | null
          destination: string
          dispatcher_id: string | null
          dispatcher_pay_amount: number | null
          driver_id: string | null
          driver_pay_amount: number | null
          empty_miles: number | null
          empty_miles_origin: string | null
          factoring: string | null
          id: string
          investor_pay_amount: number | null
          miles: number | null
          notes: string | null
          origin: string
          pdf_url: string | null
          pickup_date: string | null
          pickup_time: string | null
          reference_number: string
          route_geometry: Json | null
          service_type: string | null
          status: string
          tenant_id: string | null
          total_rate: number
          truck_id: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          bol_url?: string | null
          broker_client?: string | null
          cargo_type?: string | null
          company_id?: string | null
          company_profit?: number | null
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          destination: string
          dispatcher_id?: string | null
          dispatcher_pay_amount?: number | null
          driver_id?: string | null
          driver_pay_amount?: number | null
          empty_miles?: number | null
          empty_miles_origin?: string | null
          factoring?: string | null
          id?: string
          investor_pay_amount?: number | null
          miles?: number | null
          notes?: string | null
          origin: string
          pdf_url?: string | null
          pickup_date?: string | null
          pickup_time?: string | null
          reference_number: string
          route_geometry?: Json | null
          service_type?: string | null
          status?: string
          tenant_id?: string | null
          total_rate?: number
          truck_id?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          bol_url?: string | null
          broker_client?: string | null
          cargo_type?: string | null
          company_id?: string | null
          company_profit?: number | null
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          destination?: string
          dispatcher_id?: string | null
          dispatcher_pay_amount?: number | null
          driver_id?: string | null
          driver_pay_amount?: number | null
          empty_miles?: number | null
          empty_miles_origin?: string | null
          factoring?: string | null
          id?: string
          investor_pay_amount?: number | null
          miles?: number | null
          notes?: string | null
          origin?: string
          pdf_url?: string | null
          pickup_date?: string | null
          pickup_time?: string | null
          reference_number?: string
          route_geometry?: Json | null
          service_type?: string | null
          status?: string
          tenant_id?: string | null
          total_rate?: number
          truck_id?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_service_log: {
        Row: {
          cost: number | null
          created_at: string
          expense_id: string | null
          id: string
          invoice_photo_url: string | null
          maintenance_id: string
          notes: string | null
          odometer_miles: number
          performed_at: string
          service_lat: number | null
          service_lng: number | null
          service_location: string | null
          tenant_id: string | null
          vendor: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          expense_id?: string | null
          id?: string
          invoice_photo_url?: string | null
          maintenance_id: string
          notes?: string | null
          odometer_miles?: number
          performed_at?: string
          service_lat?: number | null
          service_lng?: number | null
          service_location?: string | null
          tenant_id?: string | null
          vendor?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          expense_id?: string | null
          id?: string
          invoice_photo_url?: string | null
          maintenance_id?: string
          notes?: string | null
          odometer_miles?: number
          performed_at?: string
          service_lat?: number | null
          service_lng?: number | null
          service_location?: string | null
          tenant_id?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_service_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_requests: {
        Row: {
          city: string
          comments: string | null
          created_at: string
          driver_name: string
          id: string
          meeting_date: string
          meeting_time: string
          phone: string
          service_interest: string | null
          state: string
          status: string
          truck_type: string
        }
        Insert: {
          city: string
          comments?: string | null
          created_at?: string
          driver_name: string
          id?: string
          meeting_date: string
          meeting_time: string
          phone: string
          service_interest?: string | null
          state: string
          status?: string
          truck_type: string
        }
        Update: {
          city?: string
          comments?: string | null
          created_at?: string
          driver_name?: string
          id?: string
          meeting_date?: string
          meeting_time?: string
          phone?: string
          service_interest?: string | null
          state?: string
          status?: string
          truck_type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          is_read: boolean
          load_id: string | null
          message: string
          tenant_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_read?: boolean
          load_id?: string | null
          message: string
          tenant_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_read?: boolean
          load_id?: string | null
          message?: string
          tenant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tokens: {
        Row: {
          completed_at: string | null
          created_at: string
          dispatch_service_client_id: string | null
          dispatcher_id: string | null
          driver_email: string | null
          driver_name: string | null
          driver_phone: string | null
          existing_investor_id: string | null
          existing_truck_id: string | null
          expires_at: string
          id: string
          service_type: string
          status: string
          tenant_id: string
          token: string
          truck_type: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dispatch_service_client_id?: string | null
          dispatcher_id?: string | null
          driver_email?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          existing_investor_id?: string | null
          existing_truck_id?: string | null
          expires_at?: string
          id?: string
          service_type?: string
          status?: string
          tenant_id: string
          token?: string
          truck_type?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dispatch_service_client_id?: string | null
          dispatcher_id?: string | null
          driver_email?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          existing_investor_id?: string | null
          existing_truck_id?: string | null
          expires_at?: string
          id?: string
          service_type?: string
          status?: string
          tenant_id?: string
          token?: string
          truck_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tokens_dispatch_service_client_id_fkey"
            columns: ["dispatch_service_client_id"]
            isOneToOne: false
            referencedRelation: "dispatch_service_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          description: string | null
          id: string
          load_adjustment_id: string | null
          payment_id: string
          reason: string
          recurring_deduction_id: string | null
          tenant_id: string | null
        }
        Insert: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          load_adjustment_id?: string | null
          payment_id: string
          reason?: string
          recurring_deduction_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          load_adjustment_id?: string | null
          payment_id?: string
          reason?: string
          recurring_deduction_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          source: string | null
          status: string
          tenant_id: string | null
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
          source?: string | null
          status?: string
          tenant_id?: string | null
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
          source?: string | null
          status?: string
          tenant_id?: string | null
          total_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_configs: {
        Row: {
          created_at: string
          max_drivers: number
          max_trucks: number
          max_users: number
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_monthly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          max_drivers?: number
          max_trucks?: number
          max_users?: number
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          max_drivers?: number
          max_trucks?: number
          max_users?: number
          name?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          updated_at?: string
        }
        Relationships: []
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
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          load_id: string
          stop_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          load_id?: string
          stop_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_master_admin: boolean
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          is_master_admin?: boolean
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_master_admin?: boolean
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          platform: string
          tenant_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          platform?: string
          tenant_id?: string | null
          token: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          platform?: string
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_adjustments: {
        Row: {
          created_at: string | null
          delta_amount: number
          id: string
          load_id: string
          recipients: Json
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delta_amount: number
          id?: string
          load_id: string
          recipients: Json
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delta_amount?: number
          id?: string
          load_id?: string
          recipients?: Json
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recurring_deductions: {
        Row: {
          amount: number
          created_at: string
          description: string
          effective_from: string
          frequency: string
          id: string
          is_active: boolean
          reason: string
          recipient_id: string
          recipient_name: string
          recipient_type: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          effective_from?: string
          frequency?: string
          id?: string
          is_active?: boolean
          reason?: string
          recipient_id: string
          recipient_name: string
          recipient_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          effective_from?: string
          frequency?: string
          id?: string
          is_active?: boolean
          reason?: string
          recipient_id?: string
          recipient_name?: string
          recipient_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_deductions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end: string
          period_start: string
          status?: string
          subscription_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          max_trucks: number
          max_users: number
          next_payment_date: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_monthly: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          max_trucks?: number
          max_users?: number
          next_payment_date?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          max_trucks?: number
          max_users?: number
          next_payment_date?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: number
          fields: Json
          file_data: string
          file_name: string
          id: string
          name: string
        }
        Insert: {
          created_at?: number
          fields?: Json
          file_data: string
          file_name: string
          id?: string
          name: string
        }
        Update: {
          created_at?: number
          fields?: Json
          file_data?: string
          file_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          current_plan: string | null
          dba_name: string | null
          dot_number: string | null
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          max_drivers: number | null
          max_loads: number | null
          mc_number: string | null
          name: string
          phone: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_plan?: string | null
          dba_name?: string | null
          dot_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          max_drivers?: number | null
          max_loads?: number | null
          mc_number?: string | null
          name: string
          phone?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_plan?: string | null
          dba_name?: string | null
          dot_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          max_drivers?: number | null
          max_loads?: number | null
          mc_number?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      truck_fixed_costs: {
        Row: {
          amount: number
          created_at: string
          description: string
          frequency: string
          id: string
          tenant_id: string | null
          truck_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          frequency?: string
          id?: string
          tenant_id?: string | null
          truck_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          tenant_id?: string | null
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_fixed_costs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          expense_id: string | null
          id: string
          interval_days: number | null
          interval_miles: number | null
          invoice_photo_url: string | null
          last_miles: number
          last_performed_at: string
          maintenance_type: string
          miles_accumulated: number
          miles_carried_forward: number | null
          next_due_date: string | null
          next_due_miles: number | null
          status: string
          tenant_id: string | null
          truck_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          interval_days?: number | null
          interval_miles?: number | null
          invoice_photo_url?: string | null
          last_miles?: number
          last_performed_at?: string
          maintenance_type: string
          miles_accumulated?: number
          miles_carried_forward?: number | null
          next_due_date?: string | null
          next_due_miles?: number | null
          status?: string
          tenant_id?: string | null
          truck_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          interval_days?: number | null
          interval_miles?: number | null
          invoice_photo_url?: string | null
          last_miles?: number
          last_performed_at?: string
          maintenance_type?: string
          miles_accumulated?: number
          miles_carried_forward?: number | null
          next_due_date?: string | null
          next_due_miles?: number | null
          status?: string
          tenant_id?: string | null
          truck_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_maintenance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          annual_inspection_expiry: string | null
          annual_inspection_photo_url: string | null
          cargo_area_photo_url: string | null
          cargo_height_in: number | null
          cargo_length_ft: number | null
          cargo_width_in: number | null
          created_at: string
          current_odometer: number | null
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
          odometer_updated_at: string | null
          rear_door_height_in: number | null
          rear_door_width_in: number | null
          rear_truck_photo_url: string | null
          registration_expiry: string | null
          registration_photo_url: string | null
          status: string
          tenant_id: string | null
          trailer_length_ft: number | null
          trailer_number: string | null
          truck_plate_photo_url: string | null
          truck_side_photo_url: string | null
          truck_type: string
          unit_number: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          annual_inspection_expiry?: string | null
          annual_inspection_photo_url?: string | null
          cargo_area_photo_url?: string | null
          cargo_height_in?: number | null
          cargo_length_ft?: number | null
          cargo_width_in?: number | null
          created_at?: string
          current_odometer?: number | null
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
          odometer_updated_at?: string | null
          rear_door_height_in?: number | null
          rear_door_width_in?: number | null
          rear_truck_photo_url?: string | null
          registration_expiry?: string | null
          registration_photo_url?: string | null
          status?: string
          tenant_id?: string | null
          trailer_length_ft?: number | null
          trailer_number?: string | null
          truck_plate_photo_url?: string | null
          truck_side_photo_url?: string | null
          truck_type?: string
          unit_number: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          annual_inspection_expiry?: string | null
          annual_inspection_photo_url?: string | null
          cargo_area_photo_url?: string | null
          cargo_height_in?: number | null
          cargo_length_ft?: number | null
          cargo_width_in?: number | null
          created_at?: string
          current_odometer?: number | null
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
          odometer_updated_at?: string | null
          rear_door_height_in?: number | null
          rear_door_width_in?: number | null
          rear_truck_photo_url?: string | null
          registration_expiry?: string | null
          registration_photo_url?: string | null
          status?: string
          tenant_id?: string | null
          trailer_length_ft?: number | null
          trailer_number?: string | null
          truck_plate_photo_url?: string | null
          truck_side_photo_url?: string | null
          truck_type?: string
          unit_number?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trucks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      weekly_production: {
        Row: {
          company_id: string | null
          company_profit: number | null
          driver_id: string | null
          driver_pay: number | null
          iso_week: number | null
          iso_year: number | null
          load_count: number | null
          service_type: string | null
          tenant_id: string | null
          total_miles: number | null
          total_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_dispatcher_id: { Args: { _user_id: string }; Returns: string }
      get_user_driver_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "master_admin"
        | "admin"
        | "accounting"
        | "dispatcher"
        | "driver"
        | "investor"
      subscription_plan: "basic" | "intermediate" | "pro"
      subscription_status:
        | "active"
        | "pending_payment"
        | "suspended"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "master_admin",
        "admin",
        "accounting",
        "dispatcher",
        "driver",
        "investor",
      ],
      subscription_plan: ["basic", "intermediate", "pro"],
      subscription_status: [
        "active",
        "pending_payment",
        "suspended",
        "cancelled",
      ],
    },
  },
} as const

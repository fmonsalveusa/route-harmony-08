
-- Table: eld_accounts
CREATE TABLE public.eld_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL DEFAULT 'hos247',
  api_user text NOT NULL,
  api_password_encrypted text NOT NULL,
  company_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eld_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read eld_accounts" ON public.eld_accounts
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert eld_accounts" ON public.eld_accounts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update eld_accounts" ON public.eld_accounts
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete eld_accounts" ON public.eld_accounts
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

-- Table: eld_vehicle_map
CREATE TABLE public.eld_vehicle_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  eld_account_id uuid REFERENCES public.eld_accounts(id) ON DELETE CASCADE NOT NULL,
  eld_vehicle_id text NOT NULL,
  eld_vehicle_name text,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eld_account_id, eld_vehicle_id)
);

ALTER TABLE public.eld_vehicle_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read eld_vehicle_map" ON public.eld_vehicle_map
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert eld_vehicle_map" ON public.eld_vehicle_map
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update eld_vehicle_map" ON public.eld_vehicle_map
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete eld_vehicle_map" ON public.eld_vehicle_map
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

-- Add source column to driver_locations to distinguish ELD vs GPS
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gps';

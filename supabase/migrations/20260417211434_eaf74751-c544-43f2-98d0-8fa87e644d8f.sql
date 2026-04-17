-- 1. Create investors table
CREATE TABLE IF NOT EXISTS public.investors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  notes           text,
  pay_percentage  numeric(5,2) NOT NULL DEFAULT 0,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (tenant isolation + master admin override)
CREATE POLICY "Tenant users can read investors"
  ON public.investors
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_master_admin(auth.uid())
  );

CREATE POLICY "Tenant users can insert investors"
  ON public.investors
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_master_admin(auth.uid())
  );

CREATE POLICY "Tenant users can update investors"
  ON public.investors
  FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_master_admin(auth.uid())
  );

CREATE POLICY "Tenant users can delete investors"
  ON public.investors
  FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_master_admin(auth.uid())
  );

-- 4. Add investor_id to drivers (nullable)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL;

-- 5. updated_at trigger
DROP TRIGGER IF EXISTS investors_updated_at ON public.investors;
CREATE TRIGGER investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
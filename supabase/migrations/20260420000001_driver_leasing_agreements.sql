-- driver_leasing_agreements: stores one leasing PDF per carrier company per driver
-- Created as a proper migration (table was previously created manually without RLS)

CREATE TABLE IF NOT EXISTS public.driver_leasing_agreements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  file_url    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_leasing_agreements ENABLE ROW LEVEL SECURITY;

-- Authenticated tenant users can read leasing agreements for drivers in their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_leasing_agreements'
      AND policyname = 'Tenant users can read driver leasing agreements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant users can read driver leasing agreements"
        ON public.driver_leasing_agreements
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
              AND (
                d.tenant_id = public.get_user_tenant_id(auth.uid())
                OR public.is_master_admin(auth.uid())
              )
          )
        )
    $policy$;
  END IF;
END $$;

-- Service role (edge function) can insert — covered by service_role bypass.
-- Also allow authenticated inserts for any driver in the same tenant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_leasing_agreements'
      AND policyname = 'Tenant users can insert driver leasing agreements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant users can insert driver leasing agreements"
        ON public.driver_leasing_agreements
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
              AND (
                d.tenant_id = public.get_user_tenant_id(auth.uid())
                OR public.is_master_admin(auth.uid())
              )
          )
        )
    $policy$;
  END IF;
END $$;

-- Tenant users can delete their own records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_leasing_agreements'
      AND policyname = 'Tenant users can delete driver leasing agreements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant users can delete driver leasing agreements"
        ON public.driver_leasing_agreements
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
              AND (
                d.tenant_id = public.get_user_tenant_id(auth.uid())
                OR public.is_master_admin(auth.uid())
              )
          )
        )
    $policy$;
  END IF;
END $$;

-- Index for fast per-driver lookups
CREATE INDEX IF NOT EXISTS idx_driver_leasing_agreements_driver_id
  ON public.driver_leasing_agreements(driver_id);

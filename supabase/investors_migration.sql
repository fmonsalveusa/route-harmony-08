-- ============================================================
-- Investors feature migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

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

-- 3. RLS policy — same pattern as all other tenant tables
CREATE POLICY "investors_tenant_isolation" ON public.investors
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. Add investor_id to drivers (nullable — existing drivers unaffected)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL;

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_investors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investors_updated_at ON public.investors;
CREATE TRIGGER investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION update_investors_updated_at();

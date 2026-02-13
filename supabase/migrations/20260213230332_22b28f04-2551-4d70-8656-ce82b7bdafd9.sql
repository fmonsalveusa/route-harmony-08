
-- Add dispatch_service_percentage to drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS dispatch_service_percentage numeric NOT NULL DEFAULT 0;

-- Create dispatch_service_invoices table
CREATE TABLE public.dispatch_service_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id text NOT NULL,
  driver_name text NOT NULL,
  invoice_number text NOT NULL,
  loads jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  percentage_applied numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  period_from date,
  period_to date,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_service_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can read dispatch_service_invoices"
ON public.dispatch_service_invoices FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert dispatch_service_invoices"
ON public.dispatch_service_invoices FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update dispatch_service_invoices"
ON public.dispatch_service_invoices FOR UPDATE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete dispatch_service_invoices"
ON public.dispatch_service_invoices FOR DELETE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_dispatch_service_invoices_updated_at
BEFORE UPDATE ON public.dispatch_service_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

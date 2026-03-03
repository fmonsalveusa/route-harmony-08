
-- Create recurring_deductions table
CREATE TABLE public.recurring_deductions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'driver',
  recipient_name text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'per_load',
  reason text NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_deductions ENABLE ROW LEVEL SECURITY;

-- RLS policies (standard tenant-based)
CREATE POLICY "Tenant users can read recurring_deductions" ON public.recurring_deductions
  FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert recurring_deductions" ON public.recurring_deductions
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update recurring_deductions" ON public.recurring_deductions
  FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete recurring_deductions" ON public.recurring_deductions
  FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER update_recurring_deductions_updated_at
  BEFORE UPDATE ON public.recurring_deductions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add recurring_deduction_id to payment_adjustments for tracking/dedup
ALTER TABLE public.payment_adjustments
  ADD COLUMN recurring_deduction_id uuid REFERENCES public.recurring_deductions(id) ON DELETE SET NULL;

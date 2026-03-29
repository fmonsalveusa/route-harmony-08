
-- Create load_adjustments table
CREATE TABLE public.load_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL DEFAULT 'deduction',
  reason TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  apply_to TEXT[] NOT NULL DEFAULT '{driver}',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.load_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can read load_adjustments"
ON public.load_adjustments FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert load_adjustments"
ON public.load_adjustments FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete load_adjustments"
ON public.load_adjustments FOR DELETE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Add load_adjustment_id to payment_adjustments for cascade link
ALTER TABLE public.payment_adjustments
ADD COLUMN load_adjustment_id UUID REFERENCES public.load_adjustments(id) ON DELETE CASCADE;

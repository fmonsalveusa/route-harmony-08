
-- Table to store fixed monthly costs per truck (insurance, leasing, etc.)
CREATE TABLE public.truck_fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, weekly, yearly
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.truck_fixed_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant users can read truck_fixed_costs"
  ON public.truck_fixed_costs FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert truck_fixed_costs"
  ON public.truck_fixed_costs FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update truck_fixed_costs"
  ON public.truck_fixed_costs FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete truck_fixed_costs"
  ON public.truck_fixed_costs FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_truck_fixed_costs_updated_at
  BEFORE UPDATE ON public.truck_fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

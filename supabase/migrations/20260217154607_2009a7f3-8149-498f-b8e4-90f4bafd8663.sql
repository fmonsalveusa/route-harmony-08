
-- Create truck_maintenance table
CREATE TABLE public.truck_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  maintenance_type text NOT NULL,
  description text,
  interval_miles numeric,
  interval_days integer,
  last_performed_at date NOT NULL DEFAULT CURRENT_DATE,
  last_miles numeric NOT NULL DEFAULT 0,
  next_due_miles numeric,
  next_due_date date,
  miles_accumulated numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  cost numeric,
  vendor text,
  expense_id uuid REFERENCES public.expenses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.truck_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can read truck_maintenance"
ON public.truck_maintenance FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert truck_maintenance"
ON public.truck_maintenance FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update truck_maintenance"
ON public.truck_maintenance FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete truck_maintenance"
ON public.truck_maintenance FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_truck_maintenance_updated_at
BEFORE UPDATE ON public.truck_maintenance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_truck_maintenance_truck_id ON public.truck_maintenance(truck_id);
CREATE INDEX idx_truck_maintenance_status ON public.truck_maintenance(status);


-- Create maintenance service log table
CREATE TABLE public.maintenance_service_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_id UUID NOT NULL REFERENCES public.truck_maintenance(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer_miles NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC,
  vendor TEXT,
  expense_id UUID REFERENCES public.expenses(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_service_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can read maintenance_service_log"
ON public.maintenance_service_log FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert maintenance_service_log"
ON public.maintenance_service_log FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete maintenance_service_log"
ON public.maintenance_service_log FOR DELETE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_maintenance_service_log_maintenance_id ON public.maintenance_service_log(maintenance_id);


-- Add arrived_at column to load_stops
ALTER TABLE public.load_stops ADD COLUMN arrived_at TIMESTAMPTZ DEFAULT NULL;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  type TEXT NOT NULL DEFAULT 'status_changed',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  driver_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Tenant users can read notifications"
ON public.notifications FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update notifications"
ON public.notifications FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete notifications"
ON public.notifications FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

-- Create driver_locations table for GPS tracking
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on driver_locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read driver_locations"
ON public.driver_locations FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert driver_locations"
ON public.driver_locations FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update driver_locations"
ON public.driver_locations FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

-- Enable Realtime for notifications and driver_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

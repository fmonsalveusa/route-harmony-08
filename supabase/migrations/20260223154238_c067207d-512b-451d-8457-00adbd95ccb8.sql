
-- Create push_tokens table for FCM push notification tokens
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies: drivers can manage their own tokens, tenant users can read
CREATE POLICY "Tenant users can read push_tokens"
ON public.push_tokens FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert push_tokens"
ON public.push_tokens FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Authenticated users can delete push_tokens"
ON public.push_tokens FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

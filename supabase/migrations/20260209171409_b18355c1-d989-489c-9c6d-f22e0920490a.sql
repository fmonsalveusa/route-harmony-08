
-- Create onboarding_tokens table
CREATE TABLE public.onboarding_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  dispatcher_id text,
  status text NOT NULL DEFAULT 'pending',
  driver_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Public can read pending tokens (needed for onboarding form validation)
CREATE POLICY "Anyone can read pending tokens"
ON public.onboarding_tokens
FOR SELECT
USING (status = 'pending' AND expires_at > now());

-- Tenant users can manage their tokens
CREATE POLICY "Tenant users can insert tokens"
ON public.onboarding_tokens
FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can read own tokens"
ON public.onboarding_tokens
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update own tokens"
ON public.onboarding_tokens
FOR UPDATE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete own tokens"
ON public.onboarding_tokens
FOR DELETE
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

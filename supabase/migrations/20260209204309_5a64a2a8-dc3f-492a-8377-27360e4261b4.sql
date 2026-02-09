
-- Function to get dispatcher_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_user_dispatcher_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id::text
  FROM public.dispatchers d
  INNER JOIN public.profiles p ON p.email = d.email
  WHERE p.id = _user_id
  AND d.tenant_id = get_user_tenant_id(_user_id)
  LIMIT 1;
$$;

-- Update loads SELECT policy: dispatchers only see their assigned loads
DROP POLICY IF EXISTS "Tenant users can read loads" ON public.loads;

CREATE POLICY "Tenant users can read loads"
ON public.loads
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      NOT has_role(auth.uid(), 'dispatcher')
      OR dispatcher_id = get_user_dispatcher_id(auth.uid())
    )
  )
);

-- Update drivers SELECT policy: dispatchers only see their assigned drivers
DROP POLICY IF EXISTS "Authorized roles can read drivers" ON public.drivers;

CREATE POLICY "Authorized roles can read drivers"
ON public.drivers
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'accounting')
      OR (
        has_role(auth.uid(), 'dispatcher')
        AND dispatcher_id = get_user_dispatcher_id(auth.uid())
      )
    )
  )
);

-- Update payments SELECT: dispatchers only see payments for their loads
DROP POLICY IF EXISTS "Tenant users can read payments" ON public.payments;

CREATE POLICY "Tenant users can read payments"
ON public.payments
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      NOT has_role(auth.uid(), 'dispatcher')
      OR load_id IN (
        SELECT id FROM public.loads
        WHERE dispatcher_id = get_user_dispatcher_id(auth.uid())
      )
    )
  )
);

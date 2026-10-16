-- La vista se ejecutaba con los permisos de su creador (security definer) y se saltaba el RLS de
-- loads: cualquiera, incluso sin sesión (anon), podía leer la producción semanal de todos los tenants.
-- Con security_invoker aplica el RLS de loads del usuario que consulta.
ALTER VIEW public.weekly_production SET (security_invoker = true);
REVOKE ALL ON public.weekly_production FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.weekly_production FROM authenticated;
GRANT SELECT ON public.weekly_production TO authenticated;

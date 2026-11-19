-- GPS en segundo plano: el plugin nativo envía cada ubicación por POST directo a la
-- Edge Function gps-ping, sin pasar por el JS (que el sistema congela con la app en segundo plano).
-- El POST nativo no lleva sesión, así que cada driver tiene un token propio en la URL.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS gps_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS drivers_gps_token_key ON public.drivers (gps_token);

-- El driver logueado obtiene su propio token (se identifica por el email de su sesión)
CREATE OR REPLACE FUNCTION public.get_my_gps_token()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT gps_token FROM drivers
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_gps_token() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_gps_token() TO authenticated;

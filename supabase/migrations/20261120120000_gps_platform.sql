-- Plataforma de la app del driver (android / ios), para saber qué permisos le aplican
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS gps_platform text;

DROP FUNCTION IF EXISTS public.report_gps_status(boolean, boolean, boolean, text, boolean, text);

CREATE OR REPLACE FUNCTION public.report_gps_status(
  p_location boolean, p_background boolean, p_notification boolean, p_app_version text, p_plugin_ok boolean,
  p_error text DEFAULT NULL::text, p_platform text DEFAULT NULL::text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated integer;
BEGIN
  UPDATE drivers
  SET gps_location_granted = p_location,
      gps_background_granted = p_background,
      gps_notification_granted = p_notification,
      gps_plugin_ok = p_plugin_ok,
      gps_check_error = p_error,
      app_version = COALESCE(p_app_version, app_version),
      gps_platform = COALESCE(p_platform, gps_platform),
      gps_permission_checked_at = now()
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.report_gps_status(boolean, boolean, boolean, text, boolean, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _driver_record RECORD;
  _match_count INTEGER;
BEGIN
  -- Count how many tenants have a driver with this email
  SELECT COUNT(DISTINCT tenant_id) INTO _match_count
  FROM public.drivers
  WHERE LOWER(email) = LOWER(NEW.email)
  AND tenant_id IS NOT NULL;

  -- Only auto-assign if exactly one tenant match (no ambiguity)
  IF _match_count = 1 THEN
    SELECT tenant_id INTO _driver_record
    FROM public.drivers
    WHERE LOWER(email) = LOWER(NEW.email)
    AND tenant_id IS NOT NULL
    LIMIT 1;

    INSERT INTO public.profiles (id, full_name, email, tenant_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      _driver_record.tenant_id
    );

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'driver', _driver_record.tenant_id);
  ELSE
    -- No match or multiple tenants: create profile without tenant
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email
    );
  END IF;

  RETURN NEW;
END;
$function$;

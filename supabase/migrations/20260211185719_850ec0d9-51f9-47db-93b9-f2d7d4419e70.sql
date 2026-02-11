
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _driver_record RECORD;
BEGIN
  -- Check if the new user's email matches an existing driver
  SELECT id, tenant_id INTO _driver_record
  FROM public.drivers
  WHERE LOWER(email) = LOWER(NEW.email)
  AND tenant_id IS NOT NULL
  LIMIT 1;

  -- Create profile with tenant_id if driver match found
  INSERT INTO public.profiles (id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    _driver_record.tenant_id
  );

  -- If driver match found, also create user_role as 'driver'
  IF _driver_record.tenant_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'driver', _driver_record.tenant_id);
  END IF;

  RETURN NEW;
END;
$function$;

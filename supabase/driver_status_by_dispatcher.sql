-- ═══ Dispatchers pueden cambiar el status de sus drivers ═══
-- Al cambiar el status de un driver, el trigger sync_user_status_from_person activa/desactiva su
-- usuario (profiles.is_active). protect_profile_privileged solo deja eso a los admins, así que al
-- dispatcher le salía "Solo un admin puede activar o desactivar usuarios".
-- Ahora la sincronización marca la transacción y el protector la deja pasar (misma empresa).

CREATE OR REPLACE FUNCTION public.sync_user_status_from_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_any_active BOOLEAN;
BEGIN
  v_email := LOWER(COALESCE(NEW.email, ''));
  IF v_email = '' THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE LOWER(email) = v_email AND is_master_admin = true) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM drivers     WHERE LOWER(email) = v_email AND status <> 'inactive'
    UNION ALL
    SELECT 1 FROM dispatchers WHERE LOWER(email) = v_email AND status <> 'inactive'
    UNION ALL
    SELECT 1 FROM investors   WHERE LOWER(email) = v_email AND COALESCE(status, 'active') <> 'inactive'
  ) INTO v_any_active;

  -- Marca para protect_profile_privileged: el cambio de is_active viene de esta sincronización
  PERFORM set_config('app.status_sync', 'on', true);
  UPDATE profiles SET is_active = v_any_active WHERE LOWER(email) = v_email;
  PERFORM set_config('app.status_sync', '', true);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sin sesión = service role o SQL (funciones del servidor): se deja pasar
  IF auth.uid() IS NULL OR public.is_master_admin(auth.uid()) THEN RETURN NEW; END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
    RAISE EXCEPTION 'No se puede cambiar la empresa ni los permisos del usuario';
  END IF;
  -- Activar/desactivar: solo un admin de la misma empresa, y no a sí mismo;
  -- o la sincronización automática al cambiar el status de un driver/dispatcher/investor
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT (
       OLD.tenant_id = public.get_user_tenant_id(auth.uid())
       AND (
         (OLD.id <> auth.uid() AND public.has_role(auth.uid(), 'admin'))
         OR current_setting('app.status_sync', true) = 'on'
       )
     ) THEN
    RAISE EXCEPTION 'Solo un admin puede activar o desactivar usuarios';
  END IF;
  RETURN NEW;
END $$;

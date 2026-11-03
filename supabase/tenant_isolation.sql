-- ═══ Aislamiento entre empresas (tenants) ═══
-- Antes de dar acceso a otra empresa: cada una solo ve y toca lo suyo.
-- Los datos que ya existen sin empresa se asignan a Dispatch Up (el tenant original).

-- ─── 1. Perfiles: nadie puede cambiarse de empresa ni darse permisos de master admin ───
CREATE OR REPLACE FUNCTION public.protect_profile_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sin sesión = service role o SQL (funciones del servidor): se deja pasar
  IF auth.uid() IS NULL OR public.is_master_admin(auth.uid()) THEN RETURN NEW; END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
    RAISE EXCEPTION 'No se puede cambiar la empresa ni los permisos del usuario';
  END IF;
  -- Activar/desactivar: solo un admin de la misma empresa, y no a sí mismo
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT (
       OLD.id <> auth.uid()
       AND public.has_role(auth.uid(), 'admin')
       AND OLD.tenant_id = public.get_user_tenant_id(auth.uid())
     ) THEN
    RAISE EXCEPTION 'Solo un admin puede activar o desactivar usuarios';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged();

-- El perfil lo crea el trigger de registro (corre como postgres y no pasa por RLS)
DROP POLICY IF EXISTS "Allow trigger to create profile" ON public.profiles;

-- El admin de cada empresa puede activar/desactivar a sus usuarios (el trigger limita qué columnas)
DROP POLICY IF EXISTS "Tenant admins can update tenant profiles" ON public.profiles;
CREATE POLICY "Tenant admins can update tenant profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK (tenant_id = (SELECT public.get_user_tenant_id(auth.uid())));

-- ─── 2. Tenant: solo el admin cambia los datos de su empresa ───
DROP POLICY IF EXISTS "Admins can update own tenant" ON public.tenants;
CREATE POLICY "Admins can update own tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK (id = (SELECT public.get_user_tenant_id(auth.uid())));

-- ─── 3. Companies: la lectura pública queda solo para el onboarding sin sesión ───
DROP POLICY IF EXISTS public_select_companies ON public.companies;
CREATE POLICY public_select_companies ON public.companies FOR SELECT TO anon USING (true);

-- ─── 4. Documentos de firma y plantillas: por empresa ───
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS template_id uuid;
UPDATE public.templates SET tenant_id = '7b4e906b-3d75-44ba-a8b0-64bc923a3c36' WHERE tenant_id IS NULL;
UPDATE public.documents SET tenant_id = '7b4e906b-3d75-44ba-a8b0-64bc923a3c36' WHERE tenant_id IS NULL;
ALTER TABLE public.templates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant_id(auth.uid());
ALTER TABLE public.documents ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant_id(auth.uid());
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON public.templates(tenant_id);

DROP POLICY IF EXISTS "Anyone can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can read documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can update documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can delete templates" ON public.templates;
DROP POLICY IF EXISTS "Anyone can insert templates" ON public.templates;
DROP POLICY IF EXISTS "Anyone can read templates" ON public.templates;
DROP POLICY IF EXISTS "Anyone can update templates" ON public.templates;

DROP POLICY IF EXISTS tenant_staff_all ON public.documents;
CREATE POLICY tenant_staff_all ON public.documents FOR ALL TO authenticated
  USING ((tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.is_tenant_staff(auth.uid()))) OR (SELECT public.is_master_admin(auth.uid())))
  WITH CHECK ((tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.is_tenant_staff(auth.uid()))) OR (SELECT public.is_master_admin(auth.uid())));
DROP POLICY IF EXISTS tenant_staff_all ON public.templates;
CREATE POLICY tenant_staff_all ON public.templates FOR ALL TO authenticated
  USING ((tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.is_tenant_staff(auth.uid()))) OR (SELECT public.is_master_admin(auth.uid())))
  WITH CHECK ((tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) AND (SELECT public.is_tenant_staff(auth.uid()))) OR (SELECT public.is_master_admin(auth.uid())));

-- Quien firma no tiene sesión: entra solo con el id del enlace, nunca puede listar
CREATE OR REPLACE FUNCTION public.signing_get_document(p_id uuid)
RETURNS SETOF public.documents LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM documents WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.signing_get_template(p_id uuid)
RETURNS SETOF public.templates LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM templates WHERE id = p_id;
$$;

-- Guarda la firma: completa un documento pendiente, o crea uno nuevo desde una plantilla
CREATE OR REPLACE FUNCTION public.signing_submit(
  p_id uuid, p_fields jsonb, p_signed_file_data text, p_signer_data jsonb, p_signed_at bigint,
  p_template_id uuid DEFAULT NULL, p_file_name text DEFAULT NULL, p_file_data text DEFAULT NULL, p_expires_at bigint DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
  t record;
BEGIN
  SELECT id, status, expires_at INTO d FROM documents WHERE id = p_id;
  IF d.id IS NOT NULL THEN
    IF d.status <> 'pending' THEN RAISE EXCEPTION 'Este documento ya fue firmado'; END IF;
    IF d.expires_at IS NOT NULL AND d.expires_at < (extract(epoch FROM now()) * 1000)::bigint THEN
      RAISE EXCEPTION 'Este documento ha expirado';
    END IF;
    UPDATE documents SET fields = p_fields, signed_file_data = p_signed_file_data, signer_data = p_signer_data,
      signed_at = p_signed_at, status = 'signed'
    WHERE id = p_id;
    RETURN;
  END IF;

  SELECT id, tenant_id, file_name, file_data INTO t FROM templates WHERE id = p_template_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Documento no encontrado'; END IF;
  INSERT INTO documents (id, tenant_id, template_id, file_name, file_data, signed_file_data, status, signed_at, expires_at, fields, signer_data)
  VALUES (p_id, t.tenant_id, t.id, COALESCE(p_file_name, t.file_name), COALESCE(p_file_data, t.file_data),
          p_signed_file_data, 'signed', p_signed_at, p_expires_at, p_fields, p_signer_data);
END $$;

GRANT EXECUTE ON FUNCTION public.signing_get_document(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signing_get_template(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signing_submit(uuid, jsonb, text, jsonb, bigint, uuid, text, text, bigint) TO anon, authenticated;

-- ─── 5. Brokers: cada empresa con su lista (notas y calificación propias) ───
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.brokers SET tenant_id = '7b4e906b-3d75-44ba-a8b0-64bc923a3c36' WHERE tenant_id IS NULL;
ALTER TABLE public.brokers ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant_id(auth.uid());
CREATE INDEX IF NOT EXISTS idx_brokers_tenant ON public.brokers(tenant_id);
DROP POLICY IF EXISTS "Authenticated users can delete brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can insert brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can read brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can update brokers" ON public.brokers;
DROP POLICY IF EXISTS tenant_all ON public.brokers;
CREATE POLICY tenant_all ON public.brokers FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) OR (SELECT public.is_master_admin(auth.uid())))
  WITH CHECK (tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) OR (SELECT public.is_master_admin(auth.uid())));

-- ─── 6. Otras tablas que cualquiera con sesión podía leer ───
-- Rutas: por la empresa de la carga
DROP POLICY IF EXISTS tenant_all ON public.load_routes;
CREATE POLICY tenant_all ON public.load_routes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM loads l WHERE l.id = load_routes.load_id
                 AND (l.tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) OR (SELECT public.is_master_admin(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM loads l WHERE l.id = load_routes.load_id
                 AND (l.tenant_id = (SELECT public.get_user_tenant_id(auth.uid())) OR (SELECT public.is_master_admin(auth.uid())))));

-- Prospectos y reuniones: son de Dispatch Up (landing y agente de WhatsApp)
DROP POLICY IF EXISTS tenant_read ON public.whatsapp_leads;
CREATE POLICY tenant_read ON public.whatsapp_leads FOR SELECT TO authenticated
  USING ((SELECT public.get_user_tenant_id(auth.uid())) = '7b4e906b-3d75-44ba-a8b0-64bc923a3c36' AND (SELECT public.is_tenant_staff(auth.uid())));
DROP POLICY IF EXISTS "Authenticated users can read meeting_requests" ON public.meeting_requests;
CREATE POLICY "Authenticated users can read meeting_requests" ON public.meeting_requests FOR SELECT TO authenticated
  USING ((SELECT public.get_user_tenant_id(auth.uid())) = '7b4e906b-3d75-44ba-a8b0-64bc923a3c36' AND (SELECT public.is_tenant_staff(auth.uid())));

-- Tokens de onboarding: los lee la función del servidor, no hace falta lectura pública
DROP POLICY IF EXISTS "Anyone can read onboarding token by token value" ON public.onboarding_tokens;

-- Leasings: solo para drivers de la propia empresa
DROP POLICY IF EXISTS service_insert_leasing ON public.driver_leasing_agreements;
CREATE POLICY service_insert_leasing ON public.driver_leasing_agreements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_leasing_agreements.driver_id
                      AND d.tenant_id = (SELECT public.get_user_tenant_id(auth.uid()))));

-- ─── 7. Funciones que no deben ejecutarse desde la app ───
REVOKE EXECUTE ON FUNCTION public.merge_drivers(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clean_old_load_routes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_profit_config(uuid, text, uuid, text, numeric, text, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_load_detention(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.effective_investor_pct(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 8. Archivos (bucket driver-documents): cada empresa ve solo los suyos ───
-- La empresa del archivo sale de quien lo subió; si lo subió el servidor, de los ids de la ruta.
-- Si no se puede saber, es de Dispatch Up (así un archivo dudoso nunca le aparece a otra empresa).
CREATE OR REPLACE FUNCTION public.storage_object_tenant(_owner text, _name text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seg text;
  u uuid;
  t uuid;
BEGIN
  IF _owner IS NOT NULL THEN
    SELECT tenant_id INTO t FROM profiles WHERE id::text = _owner;
    IF t IS NOT NULL THEN RETURN t; END IF;
  END IF;
  FOREACH seg IN ARRAY string_to_array(COALESCE(_name, ''), '/') LOOP
    IF seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      u := seg::uuid;
      SELECT id INTO t FROM tenants WHERE id = u;                         IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM drivers WHERE id = u;                  IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM loads WHERE id = u;                    IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM trucks WHERE id = u;                   IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM investors WHERE id = u;                IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM dispatch_service_clients WHERE id = u; IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM onboarding_tokens WHERE id = u;        IF t IS NOT NULL THEN RETURN t; END IF;
      SELECT tenant_id INTO t FROM documents WHERE id = u;                IF t IS NOT NULL THEN RETURN t; END IF;
    END IF;
  END LOOP;
  RETURN '7b4e906b-3d75-44ba-a8b0-64bc923a3c36'::uuid;
END $$;

DROP POLICY IF EXISTS "Tenant users can delete driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can update driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can view driver documents" ON storage.objects;
CREATE POLICY "Tenant users can view driver documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND public.storage_object_tenant(owner_id, name) = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update driver documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-documents' AND public.storage_object_tenant(owner_id, name) = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete driver documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-documents' AND public.storage_object_tenant(owner_id, name) = public.get_user_tenant_id(auth.uid()));

-- ─── 9. Salud de automatizaciones: muestra datos de todas las empresas, solo el master admin ───
CREATE OR REPLACE FUNCTION public.automation_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resultado jsonb;
BEGIN
  -- Solo usuarios con sesiÃ³n. El editor de SQL entra como postgres y no tiene sesiÃ³n,
  -- asÃ­ que se le deja pasar para poder probar la funciÃ³n desde ahÃ­.
  IF session_user = 'authenticator' AND NOT COALESCE(public.is_master_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH
  -- â”€â”€â”€ Trabajos agendados y su Ãºltima corrida â”€â”€â”€
  fallas AS (
    SELECT jobid, count(*) AS fallas_24h
    FROM cron.job_run_details
    WHERE status <> 'succeeded' AND start_time > now() - interval '24 hours'
    GROUP BY jobid
  ),
  jobs AS (
    SELECT jsonb_agg(x ORDER BY x->>'jobname') AS data
    FROM (
      SELECT jsonb_build_object(
        'jobname', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'last_run', u.start_time,
        'last_status', u.status,
        'last_error', CASE WHEN u.status <> 'succeeded' THEN left(u.return_message, 300) END,
        'failures_24h', COALESCE(f.fallas_24h, 0)
      ) AS x
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT d.status, d.start_time, d.return_message
        FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
        ORDER BY d.start_time DESC
        LIMIT 1
      ) u ON true
      LEFT JOIN fallas f ON f.jobid = j.jobid
    ) s
  ),

  -- â”€â”€â”€ Emails al broker: Ãºltimos 7 dÃ­as â”€â”€â”€
  email_conteo AS (
    SELECT status, count(*) AS n
    FROM broker_email_queue
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
  ),
  email_pegados AS (
    SELECT count(*) AS n
    FROM broker_email_queue
    WHERE status IN ('pending', 'waiting_thread')
      AND send_after < now() - interval '1 hour'
  ),
  email_fallas AS (
    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) AS data
    FROM (
      SELECT jsonb_build_object(
        'reference', l.reference_number,
        'kind', q.kind,
        'stop_type', q.stop_type,
        'attempts', q.attempts,
        'status', q.status,
        'load_status', l.status,
        'error', left(q.error, 200),
        'created_at', q.created_at
      ) AS x, q.created_at
      FROM broker_email_queue q
      LEFT JOIN loads l ON l.id = q.load_id
      WHERE q.status IN ('failed', 'skipped')
        AND q.created_at > now() - interval '7 days'
        -- De las cargas ya cerradas no hay nada que hacer, asÃ­ que solo se muestran
        -- mientras sean recientes; despuÃ©s el panel las suelta.
        AND (
          COALESCE(l.status, '') NOT IN ('delivered', 'paid', 'cancelled', 'tonu')
          OR q.created_at > now() - interval '24 hours'
        )
      ORDER BY q.created_at DESC
      LIMIT 10
    ) s
  ),
  email_ultimo AS (
    SELECT max(sent_at) AS ts FROM broker_email_queue WHERE status = 'sent'
  ),

  -- â”€â”€â”€ WhatsApp: Ãºltimos 7 dÃ­as â”€â”€â”€
  wa_conteo AS (
    SELECT status, count(*) AS n
    FROM whatsapp_message_history
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
  ),
  wa_fallas AS (
    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) AS data
    FROM (
      SELECT jsonb_build_object(
        'template_key', h.template_key,
        'recipient_name', h.recipient_name,
        'reference', h.reference,
        'error', left(h.error, 200),
        'created_at', h.created_at
      ) AS x, h.created_at
      FROM whatsapp_message_history h
      WHERE h.status = 'failed' AND h.created_at > now() - interval '7 days'
      ORDER BY h.created_at DESC
      LIMIT 10
    ) s
  ),
  wa_ultimo AS (
    SELECT max(created_at) AS ts FROM whatsapp_message_history WHERE status = 'sent'
  ),

  -- â”€â”€â”€ Cargas activas cuyo hilo de Gmail no se pudo enlazar â”€â”€â”€
  hilos AS (
    SELECT jsonb_agg(x ORDER BY x->>'reference') AS data
    FROM (
      SELECT jsonb_build_object(
        'reference', l.reference_number,
        'status', l.status,
        'thread_status', COALESCE(t.status, 'sin buscar')
      ) AS x, l.reference_number
      FROM loads l
      LEFT JOIN load_email_threads t ON t.load_id = l.id
      LEFT JOIN drivers d ON d.id::text = l.driver_id
      WHERE l.status NOT IN ('delivered', 'paid', 'cancelled', 'tonu')
        AND COALESCE(d.service_type, '') <> 'dispatch_service'
        AND COALESCE(t.status, 'sin buscar') <> 'linked'
      ORDER BY l.reference_number
      LIMIT 20
    ) s
  )

  SELECT jsonb_build_object(
    'generated_at', now(),
    'jobs', COALESCE((SELECT data FROM jobs), '[]'::jsonb),
    'broker_email', jsonb_build_object(
      'counts', COALESCE((SELECT jsonb_object_agg(status, n) FROM email_conteo), '{}'::jsonb),
      'stuck', (SELECT n FROM email_pegados),
      'last_sent', (SELECT ts FROM email_ultimo),
      'failures', COALESCE((SELECT data FROM email_fallas), '[]'::jsonb)
    ),
    'whatsapp', jsonb_build_object(
      'counts', COALESCE((SELECT jsonb_object_agg(status, n) FROM wa_conteo), '{}'::jsonb),
      'last_sent', (SELECT ts FROM wa_ultimo),
      'failures', COALESCE((SELECT data FROM wa_fallas), '[]'::jsonb)
    ),
    'unlinked_threads', COALESCE((SELECT data FROM hilos), '[]'::jsonb)
  ) INTO resultado;

  RETURN resultado;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.automation_health() FROM PUBLIC, anon;

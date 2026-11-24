-- Motive como proveedor de conexión ELD propia del driver (usuario + contraseña del portal)
ALTER TABLE public.driver_eld_connections DROP CONSTRAINT IF EXISTS driver_eld_connections_provider_check;
ALTER TABLE public.driver_eld_connections ADD CONSTRAINT driver_eld_connections_provider_check
  CHECK (provider = ANY (ARRAY['hos247'::text, 'routeone'::text, 'leveleld'::text, 'motive'::text]));

-- Sesión web de Motive guardada para no iniciar sesión en cada lectura. Solo service role (sin políticas).
CREATE TABLE IF NOT EXISTS public.eld_session_cache (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eld_session_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eld_session_cache FROM anon, authenticated;
GRANT ALL ON TABLE public.eld_session_cache TO service_role;

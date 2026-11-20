-- Hora del último cambio de status de la carga (para alertar cargas trabadas en un status)
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

UPDATE public.loads SET status_changed_at = COALESCE(updated_at, created_at) WHERE status_changed_at IS NULL;

ALTER TABLE public.loads ALTER COLUMN status_changed_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.loads_set_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loads_status_changed_at ON public.loads;
CREATE TRIGGER trg_loads_status_changed_at
  BEFORE INSERT OR UPDATE OF status ON public.loads
  FOR EACH ROW EXECUTE FUNCTION public.loads_set_status_changed_at();

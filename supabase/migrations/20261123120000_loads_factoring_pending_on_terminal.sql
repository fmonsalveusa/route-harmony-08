-- Al pasar una carga a DELIVERED o TONU, Factoring queda en 'pending' si estaba vacío.
-- Antes solo lo hacía el selector de estado de la tabla de Loads; desde el formulario de
-- edición (u otros caminos) quedaba en NULL.
CREATE OR REPLACE FUNCTION public.loads_factoring_pending_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('delivered', 'tonu') AND NEW.factoring IS NULL
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.factoring := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loads_factoring_pending_on_terminal ON public.loads;
CREATE TRIGGER trg_loads_factoring_pending_on_terminal
  BEFORE INSERT OR UPDATE OF status ON public.loads
  FOR EACH ROW EXECUTE FUNCTION public.loads_factoring_pending_on_terminal();

ALTER TABLE public.companies ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Set AG AR Transportation as primary by default
UPDATE public.companies SET is_primary = true WHERE name = 'AG AR Transportation';

-- Create a function to ensure only one company is primary per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_primary_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.companies SET is_primary = false
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_primary_company
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_primary_company();
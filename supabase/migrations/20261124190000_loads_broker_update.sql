-- Última actualización de ubicación/ETA enviada al broker desde Tracking
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS broker_update_at timestamptz;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS broker_update_note text;


ALTER TABLE public.drivers
ADD COLUMN service_type TEXT NOT NULL DEFAULT 'owner_operator';

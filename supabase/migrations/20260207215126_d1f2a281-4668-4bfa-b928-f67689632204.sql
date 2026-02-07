
-- Box Truck fields
ALTER TABLE public.trucks ADD COLUMN cargo_length_ft numeric NULL;
ALTER TABLE public.trucks ADD COLUMN cargo_width_in numeric NULL;
ALTER TABLE public.trucks ADD COLUMN cargo_height_in numeric NULL;
ALTER TABLE public.trucks ADD COLUMN rear_door_width_in numeric NULL;
ALTER TABLE public.trucks ADD COLUMN rear_door_height_in numeric NULL;

-- Hotshot fields
ALTER TABLE public.trucks ADD COLUMN trailer_length_ft numeric NULL;
ALTER TABLE public.trucks ADD COLUMN mega_ramp text NULL;

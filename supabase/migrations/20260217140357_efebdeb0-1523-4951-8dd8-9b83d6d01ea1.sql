
ALTER TABLE public.drivers
ADD COLUMN manual_location_address text,
ADD COLUMN manual_location_lat double precision,
ADD COLUMN manual_location_lng double precision;

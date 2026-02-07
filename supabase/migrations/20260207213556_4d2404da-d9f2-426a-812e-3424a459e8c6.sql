
CREATE TABLE public.trucks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_number TEXT NOT NULL,
  truck_type TEXT NOT NULL DEFAULT 'Dry Van',
  make TEXT,
  model TEXT,
  year INTEGER,
  max_payload_lbs NUMERIC,
  vin TEXT,
  license_plate TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  insurance_expiry DATE,
  registration_expiry DATE,
  registration_photo_url TEXT,
  insurance_photo_url TEXT,
  license_photo_url TEXT,
  rear_truck_photo_url TEXT,
  truck_side_photo_url TEXT,
  truck_plate_photo_url TEXT,
  cargo_area_photo_url TEXT,
  driver_id TEXT,
  investor_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read trucks"
ON public.trucks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert trucks"
ON public.trucks FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update trucks"
ON public.trucks FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete trucks"
ON public.trucks FOR DELETE USING (true);

CREATE TRIGGER update_trucks_updated_at
BEFORE UPDATE ON public.trucks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Create drivers table
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  license TEXT NOT NULL,
  license_expiry DATE,
  medical_card_expiry DATE,
  status TEXT NOT NULL DEFAULT 'available',
  dispatcher_id TEXT,
  truck_id TEXT,
  investor_name TEXT,
  pay_percentage NUMERIC NOT NULL DEFAULT 30,
  investor_pay_percentage NUMERIC DEFAULT 15,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  loads_this_month INTEGER DEFAULT 0,
  earnings_this_month NUMERIC DEFAULT 0,
  license_photo_url TEXT,
  medical_card_photo_url TEXT,
  form_w9_url TEXT,
  leasing_agreement_url TEXT,
  service_agreement_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert drivers" ON public.drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update drivers" ON public.drivers FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete drivers" ON public.drivers FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-documents', 'driver-documents', true);

CREATE POLICY "Anyone can view driver documents" ON storage.objects FOR SELECT USING (bucket_id = 'driver-documents');
CREATE POLICY "Authenticated users can upload driver documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'driver-documents');
CREATE POLICY "Authenticated users can update driver documents" ON storage.objects FOR UPDATE USING (bucket_id = 'driver-documents');
CREATE POLICY "Authenticated users can delete driver documents" ON storage.objects FOR DELETE USING (bucket_id = 'driver-documents');

-- Seed with mock data
INSERT INTO public.drivers (name, email, phone, license, status, dispatcher_id, truck_id, pay_percentage, hire_date, loads_this_month, earnings_this_month) VALUES
  ('Pedro Martinez', 'pedro@email.com', '555-1001', 'CDL-A-12345', 'assigned', 'd1', 't1', 30, '2023-01-15', 5, 7500),
  ('Miguel Rodriguez', 'miguel@email.com', '555-1002', 'CDL-A-23456', 'available', 'd1', 't2', 28, '2023-03-20', 4, 5600),
  ('Luis Garcia', 'luis@email.com', '555-1003', 'CDL-A-34567', 'assigned', 'd1', 't3', 32, '2022-11-05', 6, 9600),
  ('Carlos Hernandez', 'carlos@email.com', '555-1004', 'CDL-A-45678', 'available', 'd2', 't4', 30, '2023-07-01', 3, 4200),
  ('Jose Perez', 'jose@email.com', '555-1005', 'CDL-A-56789', 'resting', 'd2', NULL, 29, '2023-05-10', 4, 5800),
  ('Fernando Diaz', 'fernando@email.com', '555-1006', 'CDL-A-67890', 'inactive', 'd3', NULL, 30, '2022-06-01', 0, 0);

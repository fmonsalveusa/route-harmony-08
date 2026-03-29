
-- Create loads table
CREATE TABLE public.loads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  pickup_date DATE,
  delivery_date DATE,
  weight NUMERIC DEFAULT 0,
  cargo_type TEXT,
  total_rate NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  driver_id TEXT,
  truck_id TEXT,
  dispatcher_id TEXT,
  broker_client TEXT,
  driver_pay_amount NUMERIC DEFAULT 0,
  investor_pay_amount NUMERIC DEFAULT 0,
  dispatcher_pay_amount NUMERIC DEFAULT 0,
  company_profit NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read loads (admin/accounting see all, dispatcher filtering done in app)
CREATE POLICY "Authenticated users can read loads"
  ON public.loads FOR SELECT
  USING (true);

-- Allow all authenticated users to insert loads
CREATE POLICY "Authenticated users can insert loads"
  ON public.loads FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to update loads
CREATE POLICY "Authenticated users can update loads"
  ON public.loads FOR UPDATE
  USING (true);

-- Seed with existing mock data
INSERT INTO public.loads (reference_number, origin, destination, pickup_date, delivery_date, weight, cargo_type, total_rate, status, driver_id, truck_id, dispatcher_id, broker_client, driver_pay_amount, investor_pay_amount, dispatcher_pay_amount, company_profit, created_at) VALUES
  ('RC-2024-001', 'Houston, TX', 'Dallas, TX', '2024-01-15', '2024-01-16', 42000, 'Dry Van', 2500, 'delivered', 'dr1', 't1', 'd1', 'ABC Logistics', 750, 375, 200, 1175, '2024-01-14'),
  ('RC-2024-002', 'Los Angeles, CA', 'Phoenix, AZ', '2024-01-16', '2024-01-17', 38000, 'Reefer', 3200, 'in_transit', 'dr3', 't3', 'd1', 'XYZ Freight', 1024, 480, 256, 1440, '2024-01-15'),
  ('RC-2024-003', 'Miami, FL', 'Atlanta, GA', '2024-01-17', '2024-01-18', 35000, 'Flatbed', 2800, 'pending', NULL, NULL, 'd2', 'Southern Transport', 0, 0, 0, 0, '2024-01-16'),
  ('RC-2024-004', 'Chicago, IL', 'Detroit, MI', '2024-01-18', '2024-01-19', 40000, 'Dry Van', 1800, 'paid', 'dr4', 't4', 'd2', 'MidWest Carriers', 540, 0, 180, 1080, '2024-01-17'),
  ('RC-2024-005', 'Denver, CO', 'Salt Lake City, UT', '2024-01-19', '2024-01-20', 44000, 'Reefer', 3500, 'delivered', 'dr1', 't1', 'd1', 'Mountain Freight', 1050, 525, 280, 1645, '2024-01-18'),
  ('RC-2024-006', 'Nashville, TN', 'Memphis, TN', '2024-01-20', '2024-01-20', 25000, 'Dry Van', 1200, 'in_transit', 'dr2', 't2', 'd1', 'Swift Connect', 336, 180, 96, 588, '2024-01-19'),
  ('RC-2024-007', 'San Antonio, TX', 'El Paso, TX', '2024-01-21', '2024-01-22', 41000, 'Flatbed', 2900, 'pending', 'dr5', NULL, 'd2', 'Border Logistics', 841, 0, 290, 1769, '2024-01-20'),
  ('RC-2024-008', 'Seattle, WA', 'Portland, OR', '2024-01-22', '2024-01-22', 30000, 'Dry Van', 1500, 'cancelled', NULL, NULL, 'd1', 'Pacific Routes', 0, 0, 0, 0, '2024-01-21');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_loads_updated_at
  BEFORE UPDATE ON public.loads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

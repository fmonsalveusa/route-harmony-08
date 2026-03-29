
-- Create dispatchers table
CREATE TABLE public.dispatchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  commission_percentage NUMERIC NOT NULL DEFAULT 8,
  pay_type TEXT NOT NULL DEFAULT 'per_rate',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatchers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read dispatchers"
  ON public.dispatchers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert dispatchers"
  ON public.dispatchers FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update dispatchers"
  ON public.dispatchers FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete dispatchers"
  ON public.dispatchers FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_dispatchers_updated_at
  BEFORE UPDATE ON public.dispatchers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('driver', 'investor', 'dispatcher')),
  recipient_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  load_reference TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage_applied NUMERIC NOT NULL DEFAULT 0,
  total_rate NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read payments"
  ON public.payments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert payments"
  ON public.payments FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON public.payments FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete payments"
  ON public.payments FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_payments_load_id ON public.payments(load_id);
CREATE INDEX idx_payments_recipient_type ON public.payments(recipient_type);
CREATE INDEX idx_payments_status ON public.payments(status);
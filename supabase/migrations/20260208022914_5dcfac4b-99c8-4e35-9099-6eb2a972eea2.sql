
-- Table for payment adjustments (additions/deductions)
CREATE TABLE public.payment_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL DEFAULT 'deduction', -- 'addition' or 'deduction'
  reason TEXT NOT NULL DEFAULT 'other', -- detention, bonus, layover, late_fee, bank_fee, weekly_insurance_fee, other
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read payment_adjustments"
  ON public.payment_adjustments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert payment_adjustments"
  ON public.payment_adjustments FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment_adjustments"
  ON public.payment_adjustments FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete payment_adjustments"
  ON public.payment_adjustments FOR DELETE USING (true);

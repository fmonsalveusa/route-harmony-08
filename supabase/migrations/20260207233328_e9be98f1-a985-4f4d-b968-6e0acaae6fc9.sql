
-- Create table for multi-stop support
CREATE TABLE public.load_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
  address TEXT NOT NULL,
  stop_order INTEGER NOT NULL DEFAULT 0,
  date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.load_stops ENABLE ROW LEVEL SECURITY;

-- RLS policies matching loads table
CREATE POLICY "Authenticated users can read load_stops"
  ON public.load_stops FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert load_stops"
  ON public.load_stops FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update load_stops"
  ON public.load_stops FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete load_stops"
  ON public.load_stops FOR DELETE USING (true);

-- Index for efficient querying
CREATE INDEX idx_load_stops_load_id ON public.load_stops(load_id, stop_order);

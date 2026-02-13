
-- Create meeting_requests table
CREATE TABLE public.meeting_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  truck_type TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;

-- Public INSERT (no auth needed - landing page form)
CREATE POLICY "Anyone can insert meeting requests"
ON public.meeting_requests
FOR INSERT
WITH CHECK (true);

-- Only authenticated tenant users can read
CREATE POLICY "Authenticated users can read meeting requests"
ON public.meeting_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

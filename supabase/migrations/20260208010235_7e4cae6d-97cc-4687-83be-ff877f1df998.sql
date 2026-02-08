
-- Table to store POD (Proof of Delivery) documents per load stop
CREATE TABLE public.pod_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES public.load_stops(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pod_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pod_documents"
  ON public.pod_documents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert pod_documents"
  ON public.pod_documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can delete pod_documents"
  ON public.pod_documents FOR DELETE USING (true);

-- Index for fast lookup
CREATE INDEX idx_pod_documents_load_id ON public.pod_documents(load_id);
CREATE INDEX idx_pod_documents_stop_id ON public.pod_documents(stop_id);

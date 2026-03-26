
-- Tabla documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_data text NOT NULL,
  signed_file_data text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  signed_at bigint,
  expires_at bigint NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  signer_data jsonb,
  recipient_email text,
  CONSTRAINT documents_pkey PRIMARY KEY (id)
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read documents" ON public.documents FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert documents" ON public.documents FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update documents" ON public.documents FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete documents" ON public.documents FOR DELETE TO public USING (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- Tabla templates
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_name text NOT NULL,
  file_data text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  CONSTRAINT templates_pkey PRIMARY KEY (id)
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates" ON public.templates FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert templates" ON public.templates FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update templates" ON public.templates FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete templates" ON public.templates FOR DELETE TO public USING (true);

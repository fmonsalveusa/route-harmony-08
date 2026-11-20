-- Emails enviados a brokers desde la extensión de DAT (botón "✉ Email" en el detalle de la carga)
CREATE TABLE IF NOT EXISTS public.dat_broker_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  posting_id text,
  broker text,
  broker_mc text,
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  origin text,
  destination text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dat_broker_emails_tenant_created ON public.dat_broker_emails (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dat_broker_emails_posting ON public.dat_broker_emails (posting_id);

ALTER TABLE public.dat_broker_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dat_broker_emails_tenant_read ON public.dat_broker_emails;
CREATE POLICY dat_broker_emails_tenant_read ON public.dat_broker_emails
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

GRANT ALL ON TABLE public.dat_broker_emails TO authenticated, service_role;

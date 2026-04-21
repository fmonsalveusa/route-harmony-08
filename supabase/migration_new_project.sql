-- =======================================================================
-- DISPATCH UP — COMPLETE SCHEMA MIGRATION
-- Target: New Supabase project (tejzatzzwivvaznxyqej)
-- Generated: 2026-04-17
-- Run this in ONE SHOT in the SQL Editor of the new Supabase project.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'master_admin',
  'admin',
  'accounting',
  'dispatcher',
  'driver',
  'investor'
);

CREATE TYPE public.subscription_plan AS ENUM (
  'basic',
  'intermediate',
  'pro'
);

CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'pending_payment',
  'suspended',
  'cancelled'
);

-- -----------------------------------------------------------------------
-- 2. updated_at helper function (needed by all tables with triggers)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------
-- 3. Base tables: tenants → profiles → user_roles
-- -----------------------------------------------------------------------

-- 3a. TENANTS
CREATE TABLE public.tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  legal_name            TEXT,
  dba_name              TEXT,
  dot_number            TEXT,
  mc_number             TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  country               TEXT DEFAULT 'US',
  phone                 TEXT,
  email                 TEXT,
  website               TEXT,
  logo_url              TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  subscription_status   TEXT DEFAULT 'trialing',
  current_plan          TEXT DEFAULT 'trial',
  trial_ends_at         TIMESTAMPTZ,
  subscription_ends_at  TIMESTAMPTZ,
  max_drivers           INTEGER DEFAULT 5,
  max_loads             INTEGER DEFAULT -1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3b. PROFILES (id = auth.users.id)
CREATE TABLE public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  avatar_url     TEXT,
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_master_admin BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3c. USER_ROLES
CREATE TABLE public.user_roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 4. Security-definer helper functions (must exist before RLS policies)
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_master_admin, false) FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------
-- 5. Subscriptions / plan config tables
-- -----------------------------------------------------------------------

-- 5a. PLAN_CONFIGS (global, no tenant_id)
CREATE TABLE public.plan_configs (
  plan           public.subscription_plan PRIMARY KEY,
  name           TEXT NOT NULL,
  price_monthly  NUMERIC NOT NULL DEFAULT 0,
  max_users      INTEGER NOT NULL DEFAULT 0,
  max_trucks     INTEGER NOT NULL DEFAULT 0,
  max_drivers    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- 5b. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan              public.subscription_plan NOT NULL DEFAULT 'basic',
  status            public.subscription_status NOT NULL DEFAULT 'active',
  price_monthly     NUMERIC NOT NULL DEFAULT 199,
  max_users         INTEGER NOT NULL DEFAULT 1,
  max_trucks        INTEGER NOT NULL DEFAULT 5,
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  next_payment_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 5c. SUBSCRIPTION_PAYMENTS
CREATE TABLE public.subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount          NUMERIC NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'paid',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 6. Business data tables
-- -----------------------------------------------------------------------

-- 6a. COMPANIES
CREATE TABLE public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  legal_name TEXT,
  mc_number  TEXT,
  dot_number TEXT,
  address    TEXT,
  city       TEXT,
  state      TEXT,
  zip        TEXT,
  phone      TEXT,
  email      TEXT,
  website    TEXT,
  logo_url   TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 6b. BROKERS (shared/global — no tenant_id)
CREATE TABLE public.brokers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  mc_number   TEXT,
  rating      TEXT,
  days_to_pay INTEGER,
  notes       TEXT,
  loads_count INTEGER NOT NULL DEFAULT 0,
  dot_number  TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

-- 6c. BROKER_CREDIT_SCORES
CREATE TABLE public.broker_credit_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name TEXT NOT NULL,
  score       INTEGER,
  days_to_pay INTEGER,
  rating      TEXT,
  notes       TEXT,
  mc_number   TEXT,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_credit_scores ENABLE ROW LEVEL SECURITY;

-- 6d. TRUCKS
CREATE TABLE public.trucks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number            TEXT NOT NULL,
  truck_type             TEXT NOT NULL DEFAULT 'Dry Van',
  make                   TEXT,
  model                  TEXT,
  year                   INTEGER,
  max_payload_lbs        NUMERIC,
  vin                    TEXT,
  license_plate          TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
  insurance_expiry       DATE,
  registration_expiry    DATE,
  registration_photo_url TEXT,
  insurance_photo_url    TEXT,
  license_photo_url      TEXT,
  rear_truck_photo_url   TEXT,
  truck_side_photo_url   TEXT,
  truck_plate_photo_url  TEXT,
  cargo_area_photo_url   TEXT,
  driver_id              TEXT,
  investor_id            TEXT,
  cargo_length_ft        NUMERIC,
  cargo_width_in         NUMERIC,
  cargo_height_in        NUMERIC,
  rear_door_width_in     NUMERIC,
  rear_door_height_in    NUMERIC,
  trailer_length_ft      NUMERIC,
  mega_ramp              TEXT,
  tenant_id              UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

-- 6e. INVESTORS
CREATE TABLE public.investors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  notes          TEXT,
  pay_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

-- 6f. DRIVERS
CREATE TABLE public.drivers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  email                       TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  license                     TEXT NOT NULL,
  license_expiry              DATE,
  medical_card_expiry         DATE,
  status                      TEXT NOT NULL DEFAULT 'available',
  dispatcher_id               TEXT,
  truck_id                    TEXT,
  investor_name               TEXT,
  investor_email              TEXT,
  pay_percentage              NUMERIC NOT NULL DEFAULT 30,
  investor_pay_percentage     NUMERIC DEFAULT 15,
  hire_date                   DATE NOT NULL DEFAULT CURRENT_DATE,
  loads_this_month            INTEGER DEFAULT 0,
  earnings_this_month         NUMERIC DEFAULT 0,
  license_photo_url           TEXT,
  medical_card_photo_url      TEXT,
  form_w9_url                 TEXT,
  leasing_agreement_url       TEXT,
  leasing_agreement_venco_url TEXT,
  leasing_agreement_58_url    TEXT,
  service_agreement_url       TEXT,
  employment_contract_url     TEXT,
  termination_letter_url      TEXT,
  service_type                TEXT NOT NULL DEFAULT 'owner_operator',
  factoring_percentage        NUMERIC NOT NULL DEFAULT 2,
  dispatch_service_percentage NUMERIC NOT NULL DEFAULT 0,
  hide_payments               BOOLEAN NOT NULL DEFAULT false,
  address                     TEXT,
  city                        TEXT,
  state                       TEXT,
  zip                         TEXT,
  birthday                    DATE,
  emergency_contact_name      TEXT,
  emergency_phone             TEXT,
  manual_location_address     TEXT,
  manual_location_lat         DOUBLE PRECISION,
  manual_location_lng         DOUBLE PRECISION,
  investor_id                 UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  tenant_id                   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 6g. DISPATCHERS
CREATE TABLE public.dispatchers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  email                       TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active',
  commission_percentage       NUMERIC NOT NULL DEFAULT 8,
  commission_2_percentage     NUMERIC NOT NULL DEFAULT 0,
  pay_type                    TEXT NOT NULL DEFAULT 'per_rate',
  dispatch_service_percentage NUMERIC NOT NULL DEFAULT 0,
  start_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  tenant_id                   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatchers ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 7. Loads and related tables
-- -----------------------------------------------------------------------

-- 7a. LOADS
CREATE TABLE public.loads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number    TEXT NOT NULL,
  origin              TEXT NOT NULL,
  destination         TEXT NOT NULL,
  pickup_date         DATE,
  delivery_date       DATE,
  weight              NUMERIC DEFAULT 0,
  cargo_type          TEXT,
  total_rate          NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  driver_id           TEXT,
  truck_id            TEXT,
  dispatcher_id       TEXT,
  broker_client       TEXT,
  driver_pay_amount   NUMERIC DEFAULT 0,
  investor_pay_amount NUMERIC DEFAULT 0,
  dispatcher_pay_amount NUMERIC DEFAULT 0,
  company_profit      NUMERIC DEFAULT 0,
  miles               NUMERIC DEFAULT 0,
  empty_miles         NUMERIC DEFAULT 0,
  empty_miles_origin  TEXT,
  factoring           TEXT,
  service_type        TEXT,
  pdf_url             TEXT,
  bol_url             TEXT,
  notes               TEXT,
  route_geometry      JSONB,
  company_id          UUID,
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;

-- 7b. LOAD_STOPS
CREATE TABLE public.load_stops (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id             UUID NOT NULL,
  stop_type           TEXT NOT NULL,
  address             TEXT NOT NULL,
  stop_order          INTEGER NOT NULL DEFAULT 0,
  date                DATE,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  distance_from_prev  NUMERIC,
  arrived_at          TIMESTAMPTZ,
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.load_stops ENABLE ROW LEVEL SECURITY;

-- 7c. LOAD_ADJUSTMENTS
CREATE TABLE public.load_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id         UUID NOT NULL,
  adjustment_type TEXT NOT NULL DEFAULT 'deduction',
  reason          TEXT NOT NULL DEFAULT 'other',
  description     TEXT,
  amount          NUMERIC NOT NULL DEFAULT 0,
  apply_to        TEXT[] NOT NULL DEFAULT '{driver}',
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.load_adjustments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 8. Payment tables
-- -----------------------------------------------------------------------

-- 8a. PAYMENTS
CREATE TABLE public.payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id            UUID NOT NULL,
  recipient_type     TEXT NOT NULL,
  recipient_id       TEXT NOT NULL,
  recipient_name     TEXT NOT NULL,
  load_reference     TEXT NOT NULL,
  amount             NUMERIC NOT NULL DEFAULT 0,
  percentage_applied NUMERIC NOT NULL DEFAULT 0,
  total_rate         NUMERIC NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending',
  payment_date       DATE,
  tenant_id          UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 8b. PAYMENT_ADJUSTMENTS
CREATE TABLE public.payment_adjustments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id           UUID NOT NULL,
  adjustment_type      TEXT NOT NULL DEFAULT 'deduction',
  reason               TEXT NOT NULL DEFAULT 'other',
  description          TEXT,
  amount               NUMERIC NOT NULL DEFAULT 0,
  load_adjustment_id   UUID,
  recurring_deduction_id UUID,
  tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;

-- 8c. RECURRING_DEDUCTIONS
CREATE TABLE public.recurring_deductions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'driver',
  recipient_name TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount         NUMERIC NOT NULL DEFAULT 0,
  frequency      TEXT NOT NULL DEFAULT 'per_load',
  reason         TEXT NOT NULL DEFAULT 'other',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_deductions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 9. Dispatcher payments
-- -----------------------------------------------------------------------

-- 9a. DISPATCHER_PAYMENT_ITEMS
CREATE TABLE public.dispatcher_payment_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         UUID NOT NULL,
  load_id            UUID NOT NULL,
  load_reference     TEXT NOT NULL,
  total_rate         NUMERIC NOT NULL DEFAULT 0,
  percentage_applied NUMERIC NOT NULL DEFAULT 0,
  amount             NUMERIC NOT NULL DEFAULT 0,
  tenant_id          UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatcher_payment_items ENABLE ROW LEVEL SECURITY;

-- 9b. DISPATCH_SERVICE_INVOICES
CREATE TABLE public.dispatch_service_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           TEXT NOT NULL,
  driver_name         TEXT NOT NULL,
  invoice_number      TEXT NOT NULL,
  loads               JSONB NOT NULL DEFAULT '[]',
  total_amount        NUMERIC NOT NULL DEFAULT 0,
  percentage_applied  NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  notes               TEXT,
  period_from         DATE,
  period_to           DATE,
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_service_invoices ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 10. Invoices, documents, POD
-- -----------------------------------------------------------------------

-- 10a. INVOICES
CREATE TABLE public.invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id        UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  broker_name    TEXT NOT NULL,
  company_id     UUID,
  company_name   TEXT,
  amount         NUMERIC NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending',
  pdf_url        TEXT,
  notes          TEXT,
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 10b. POD_DOCUMENTS
CREATE TABLE public.pod_documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id    UUID NOT NULL,
  stop_id    UUID,
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_type  TEXT NOT NULL DEFAULT 'image',
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pod_documents ENABLE ROW LEVEL SECURITY;

-- 10c. TEMPLATES (global, no tenant_id — bigint created_at)
CREATE TABLE public.templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_data  TEXT NOT NULL,
  fields     JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * 1000)::bigint)
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 10d. DOCUMENTS (global, no tenant_id — bigint created_at)
CREATE TABLE public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        TEXT NOT NULL,
  file_data        TEXT NOT NULL,
  signed_file_data TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * 1000)::bigint),
  signed_at        BIGINT,
  expires_at       BIGINT NOT NULL,
  fields           JSONB NOT NULL DEFAULT '[]',
  signer_data      JSONB,
  recipient_email  TEXT
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 11. Expenses
-- -----------------------------------------------------------------------

-- 11a. EXPENSES
CREATE TABLE public.expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  truck_id            UUID,
  driver_name         TEXT,
  driver_service_type TEXT,
  expense_type        TEXT NOT NULL DEFAULT 'fuel',
  category            TEXT,
  description         TEXT NOT NULL DEFAULT '',
  amount              NUMERIC NOT NULL DEFAULT 0,
  tax_amount          NUMERIC DEFAULT 0,
  total_amount        NUMERIC,
  payment_method      TEXT NOT NULL DEFAULT 'fleet_card',
  vendor              TEXT,
  location            TEXT,
  odometer_reading    NUMERIC,
  invoice_number      TEXT,
  notes               TEXT,
  source              TEXT NOT NULL DEFAULT 'manual',
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 11b. EXPENSE_RECEIPTS
CREATE TABLE public.expense_receipts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL,
  file_name  TEXT NOT NULL,
  file_url   TEXT NOT NULL,
  file_type  TEXT NOT NULL DEFAULT 'image',
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 12. Truck maintenance
-- -----------------------------------------------------------------------

-- 12a. TRUCK_MAINTENANCE
CREATE TABLE public.truck_maintenance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id          UUID NOT NULL,
  maintenance_type  TEXT NOT NULL,
  description       TEXT,
  interval_miles    NUMERIC,
  interval_days     INTEGER,
  last_performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  last_miles        NUMERIC NOT NULL DEFAULT 0,
  next_due_miles    NUMERIC,
  next_due_date     DATE,
  miles_accumulated NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ok',
  cost              NUMERIC,
  vendor            TEXT,
  expense_id        UUID,
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.truck_maintenance ENABLE ROW LEVEL SECURITY;

-- 12b. MAINTENANCE_SERVICE_LOG
CREATE TABLE public.maintenance_service_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id UUID NOT NULL,
  performed_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer_miles NUMERIC NOT NULL DEFAULT 0,
  cost           NUMERIC,
  vendor         TEXT,
  expense_id     UUID,
  notes          TEXT,
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_service_log ENABLE ROW LEVEL SECURITY;

-- 12c. TRUCK_FIXED_COSTS
CREATE TABLE public.truck_fixed_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id    UUID NOT NULL,
  description TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  frequency   TEXT NOT NULL DEFAULT 'monthly',
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.truck_fixed_costs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 13. Notifications / comms
-- -----------------------------------------------------------------------

-- 13a. NOTIFICATIONS
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL DEFAULT 'status_changed',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  load_id    UUID,
  driver_id  TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 13b. ONBOARDING_TOKENS
CREATE TABLE public.onboarding_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token         TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  dispatcher_id TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  driver_name   TEXT,
  driver_email  TEXT,
  driver_phone  TEXT,
  truck_type    TEXT,
  service_type  TEXT NOT NULL DEFAULT 'owner_operator',
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- 13c. PUSH_TOKENS
CREATE TABLE public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  TEXT NOT NULL,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'android',
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 14. Driver locations
-- -----------------------------------------------------------------------
CREATE TABLE public.driver_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  speed      DOUBLE PRECISION,
  heading    DOUBLE PRECISION,
  accuracy   DOUBLE PRECISION,
  source     TEXT NOT NULL DEFAULT 'gps',
  tenant_id  UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 15. ELD
-- -----------------------------------------------------------------------

-- 15a. ELD_ACCOUNTS
CREATE TABLE public.eld_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              TEXT NOT NULL DEFAULT 'hos247',
  api_user              TEXT NOT NULL,
  api_password_encrypted TEXT NOT NULL,
  company_id            TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_synced_at        TIMESTAMPTZ,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.eld_accounts ENABLE ROW LEVEL SECURITY;

-- 15b. ELD_VEHICLE_MAP
CREATE TABLE public.eld_vehicle_map (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eld_account_id   UUID NOT NULL,
  eld_vehicle_id   TEXT NOT NULL,
  eld_vehicle_name TEXT,
  driver_id        UUID,
  truck_id         UUID,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.eld_vehicle_map ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 16. Meeting requests (public — no tenant_id)
-- -----------------------------------------------------------------------
CREATE TABLE public.meeting_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name      TEXT NOT NULL,
  phone            TEXT NOT NULL,
  city             TEXT NOT NULL,
  state            TEXT NOT NULL,
  truck_type       TEXT NOT NULL,
  meeting_date     DATE NOT NULL,
  meeting_time     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  service_interest TEXT,
  comments         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;

-- =======================================================================
-- RLS POLICIES
-- =======================================================================

-- Helper macro: all tenant tables use the same 4-policy pattern:
-- SELECT: tenant match OR master_admin
-- INSERT: tenant match OR master_admin (WITH CHECK)
-- UPDATE: tenant match OR master_admin
-- DELETE: tenant match OR master_admin

-- TENANTS
CREATE POLICY "Master admin can do all on tenants"
  ON public.tenants FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Users can view own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can update own tenant"
  ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id(auth.uid()));

-- PROFILES
CREATE POLICY "Allow trigger to create profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own profile and tenant"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_master_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Master admin can manage profiles"
  ON public.profiles FOR ALL
  USING (public.is_master_admin(auth.uid()));

-- USER_ROLES
CREATE POLICY "Master admin can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage roles"
  ON public.user_roles FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- SUBSCRIPTIONS
CREATE POLICY "Master admin can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- SUBSCRIPTION_PAYMENTS
CREATE POLICY "Master admin can manage subscription payments"
  ON public.subscription_payments FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can view own subscription payments"
  ON public.subscription_payments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- PLAN_CONFIGS (everyone can read, master_admin manages)
CREATE POLICY "Anyone can read plan configs"
  ON public.plan_configs FOR SELECT
  USING (true);

CREATE POLICY "Master admin can manage plan configs"
  ON public.plan_configs FOR ALL
  USING (public.is_master_admin(auth.uid()));

-- COMPANIES
CREATE POLICY "Tenant users can read companies"
  ON public.companies FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert companies"
  ON public.companies FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update companies"
  ON public.companies FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete companies"
  ON public.companies FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- BROKERS (shared global — all authenticated users)
CREATE POLICY "Authenticated users can read brokers"
  ON public.brokers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert brokers"
  ON public.brokers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update brokers"
  ON public.brokers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete brokers"
  ON public.brokers FOR DELETE USING (auth.uid() IS NOT NULL);

-- BROKER_CREDIT_SCORES
CREATE POLICY "Tenant users can read broker_credit_scores"
  ON public.broker_credit_scores FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert broker_credit_scores"
  ON public.broker_credit_scores FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update broker_credit_scores"
  ON public.broker_credit_scores FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete broker_credit_scores"
  ON public.broker_credit_scores FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- TRUCKS
CREATE POLICY "Tenant users can read trucks"
  ON public.trucks FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update trucks"
  ON public.trucks FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete trucks"
  ON public.trucks FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- INVESTORS
CREATE POLICY "Tenant users can read investors"
  ON public.investors FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert investors"
  ON public.investors FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update investors"
  ON public.investors FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete investors"
  ON public.investors FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- DRIVERS
CREATE POLICY "Tenant users can read drivers"
  ON public.drivers FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update drivers"
  ON public.drivers FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete drivers"
  ON public.drivers FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- DISPATCHERS
CREATE POLICY "Tenant users can read dispatchers"
  ON public.dispatchers FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert dispatchers"
  ON public.dispatchers FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update dispatchers"
  ON public.dispatchers FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete dispatchers"
  ON public.dispatchers FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- LOADS
CREATE POLICY "Tenant users can read loads"
  ON public.loads FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert loads"
  ON public.loads FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update loads"
  ON public.loads FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete loads"
  ON public.loads FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- LOAD_STOPS
CREATE POLICY "Tenant users can read load_stops"
  ON public.load_stops FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert load_stops"
  ON public.load_stops FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update load_stops"
  ON public.load_stops FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete load_stops"
  ON public.load_stops FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- LOAD_ADJUSTMENTS
CREATE POLICY "Tenant users can read load_adjustments"
  ON public.load_adjustments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert load_adjustments"
  ON public.load_adjustments FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update load_adjustments"
  ON public.load_adjustments FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete load_adjustments"
  ON public.load_adjustments FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- PAYMENTS
CREATE POLICY "Tenant users can read payments"
  ON public.payments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update payments"
  ON public.payments FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete payments"
  ON public.payments FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- PAYMENT_ADJUSTMENTS
CREATE POLICY "Tenant users can read payment_adjustments"
  ON public.payment_adjustments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payment_adjustments"
  ON public.payment_adjustments FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update payment_adjustments"
  ON public.payment_adjustments FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete payment_adjustments"
  ON public.payment_adjustments FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- RECURRING_DEDUCTIONS
CREATE POLICY "Tenant users can read recurring_deductions"
  ON public.recurring_deductions FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert recurring_deductions"
  ON public.recurring_deductions FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update recurring_deductions"
  ON public.recurring_deductions FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete recurring_deductions"
  ON public.recurring_deductions FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- DISPATCHER_PAYMENT_ITEMS
CREATE POLICY "Tenant users can read dispatcher_payment_items"
  ON public.dispatcher_payment_items FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert dispatcher_payment_items"
  ON public.dispatcher_payment_items FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update dispatcher_payment_items"
  ON public.dispatcher_payment_items FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete dispatcher_payment_items"
  ON public.dispatcher_payment_items FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- DISPATCH_SERVICE_INVOICES
CREATE POLICY "Tenant users can read dispatch_service_invoices"
  ON public.dispatch_service_invoices FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert dispatch_service_invoices"
  ON public.dispatch_service_invoices FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update dispatch_service_invoices"
  ON public.dispatch_service_invoices FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete dispatch_service_invoices"
  ON public.dispatch_service_invoices FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- INVOICES
CREATE POLICY "Tenant users can read invoices"
  ON public.invoices FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update invoices"
  ON public.invoices FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete invoices"
  ON public.invoices FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- POD_DOCUMENTS
CREATE POLICY "Tenant users can read pod_documents"
  ON public.pod_documents FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert pod_documents"
  ON public.pod_documents FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update pod_documents"
  ON public.pod_documents FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete pod_documents"
  ON public.pod_documents FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- TEMPLATES (public access)
CREATE POLICY "Anyone can read templates"
  ON public.templates FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert templates"
  ON public.templates FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update templates"
  ON public.templates FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete templates"
  ON public.templates FOR DELETE TO public USING (true);

-- DOCUMENTS (public access)
CREATE POLICY "Anyone can read documents"
  ON public.documents FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert documents"
  ON public.documents FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update documents"
  ON public.documents FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete documents"
  ON public.documents FOR DELETE TO public USING (true);

-- EXPENSES
CREATE POLICY "Tenant users can read expenses"
  ON public.expenses FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update expenses"
  ON public.expenses FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete expenses"
  ON public.expenses FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- EXPENSE_RECEIPTS
CREATE POLICY "Tenant users can read expense_receipts"
  ON public.expense_receipts FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert expense_receipts"
  ON public.expense_receipts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete expense_receipts"
  ON public.expense_receipts FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- TRUCK_MAINTENANCE
CREATE POLICY "Tenant users can read truck_maintenance"
  ON public.truck_maintenance FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert truck_maintenance"
  ON public.truck_maintenance FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update truck_maintenance"
  ON public.truck_maintenance FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete truck_maintenance"
  ON public.truck_maintenance FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- MAINTENANCE_SERVICE_LOG
CREATE POLICY "Tenant users can read maintenance_service_log"
  ON public.maintenance_service_log FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert maintenance_service_log"
  ON public.maintenance_service_log FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete maintenance_service_log"
  ON public.maintenance_service_log FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- TRUCK_FIXED_COSTS
CREATE POLICY "Tenant users can read truck_fixed_costs"
  ON public.truck_fixed_costs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert truck_fixed_costs"
  ON public.truck_fixed_costs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update truck_fixed_costs"
  ON public.truck_fixed_costs FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete truck_fixed_costs"
  ON public.truck_fixed_costs FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Tenant users can read notifications"
  ON public.notifications FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update notifications"
  ON public.notifications FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete notifications"
  ON public.notifications FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- ONBOARDING_TOKENS
CREATE POLICY "Tenant users can read onboarding_tokens"
  ON public.onboarding_tokens FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert onboarding_tokens"
  ON public.onboarding_tokens FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update onboarding_tokens"
  ON public.onboarding_tokens FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Anyone can read onboarding token by token value"
  ON public.onboarding_tokens FOR SELECT
  USING (true);

-- PUSH_TOKENS
CREATE POLICY "Tenant users can read push_tokens"
  ON public.push_tokens FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Authenticated users can insert push_tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Tenant users can delete push_tokens"
  ON public.push_tokens FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- DRIVER_LOCATIONS
CREATE POLICY "Tenant users can read driver_locations"
  ON public.driver_locations FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert driver_locations"
  ON public.driver_locations FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update driver_locations"
  ON public.driver_locations FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete driver_locations"
  ON public.driver_locations FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- ELD_ACCOUNTS
CREATE POLICY "Tenant users can read eld_accounts"
  ON public.eld_accounts FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert eld_accounts"
  ON public.eld_accounts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update eld_accounts"
  ON public.eld_accounts FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete eld_accounts"
  ON public.eld_accounts FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- ELD_VEHICLE_MAP
CREATE POLICY "Tenant users can read eld_vehicle_map"
  ON public.eld_vehicle_map FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert eld_vehicle_map"
  ON public.eld_vehicle_map FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update eld_vehicle_map"
  ON public.eld_vehicle_map FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete eld_vehicle_map"
  ON public.eld_vehicle_map FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

-- MEETING_REQUESTS (public insert — anyone can submit a meeting request form)
CREATE POLICY "Anyone can insert meeting_requests"
  ON public.meeting_requests FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Master admin can manage meeting_requests"
  ON public.meeting_requests FOR ALL
  USING (public.is_master_admin(auth.uid()));
CREATE POLICY "Authenticated users can read meeting_requests"
  ON public.meeting_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =======================================================================
-- TRIGGERS (updated_at)
-- =======================================================================
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_credit_scores_updated_at
  BEFORE UPDATE ON public.broker_credit_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at
  BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatchers_updated_at
  BEFORE UPDATE ON public.dispatchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loads_updated_at
  BEFORE UPDATE ON public.loads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_deductions_updated_at
  BEFORE UPDATE ON public.recurring_deductions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_truck_maintenance_updated_at
  BEFORE UPDATE ON public.truck_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_truck_fixed_costs_updated_at
  BEFORE UPDATE ON public.truck_fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatch_service_invoices_updated_at
  BEFORE UPDATE ON public.dispatch_service_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_eld_accounts_updated_at
  BEFORE UPDATE ON public.eld_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_eld_vehicle_map_updated_at
  BEFORE UPDATE ON public.eld_vehicle_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_configs_updated_at
  BEFORE UPDATE ON public.plan_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================================================================
-- INDEXES
-- =======================================================================
CREATE INDEX idx_profiles_tenant_id          ON public.profiles(tenant_id);
CREATE INDEX idx_user_roles_user_id          ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id        ON public.user_roles(tenant_id);
CREATE INDEX idx_subscriptions_tenant_id     ON public.subscriptions(tenant_id);
CREATE INDEX idx_companies_tenant_id         ON public.companies(tenant_id);
CREATE INDEX idx_loads_tenant_id             ON public.loads(tenant_id);
CREATE INDEX idx_loads_status                ON public.loads(status);
CREATE INDEX idx_drivers_tenant_id           ON public.drivers(tenant_id);
CREATE INDEX idx_trucks_tenant_id            ON public.trucks(tenant_id);
CREATE INDEX idx_dispatchers_tenant_id       ON public.dispatchers(tenant_id);
CREATE INDEX idx_payments_tenant_id          ON public.payments(tenant_id);
CREATE INDEX idx_payments_status             ON public.payments(status);
CREATE INDEX idx_invoices_tenant_id          ON public.invoices(tenant_id);
CREATE INDEX idx_load_stops_tenant_id        ON public.load_stops(tenant_id);
CREATE INDEX idx_load_stops_load_id          ON public.load_stops(load_id);
CREATE INDEX idx_payment_adjustments_tenant  ON public.payment_adjustments(tenant_id);
CREATE INDEX idx_pod_documents_tenant_id     ON public.pod_documents(tenant_id);
CREATE INDEX idx_pod_documents_load_id       ON public.pod_documents(load_id);
CREATE INDEX idx_expenses_tenant_id          ON public.expenses(tenant_id);
CREATE INDEX idx_notifications_tenant_id     ON public.notifications(tenant_id);
CREATE INDEX idx_driver_locations_tenant_id  ON public.driver_locations(tenant_id);
CREATE INDEX idx_driver_locations_driver_id  ON public.driver_locations(driver_id);
CREATE INDEX idx_investors_tenant_id         ON public.investors(tenant_id);
CREATE INDEX idx_broker_credit_tenant_id     ON public.broker_credit_scores(tenant_id);

-- =======================================================================
-- STORAGE BUCKET
-- =======================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant users can view driver documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can upload driver documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can update driver documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'driver-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can delete driver documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'driver-documents' AND auth.uid() IS NOT NULL);

-- =======================================================================
-- REALTIME PUBLICATIONS
-- =======================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.loads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- =======================================================================
-- SEED: plan_configs
-- =======================================================================
INSERT INTO public.plan_configs (plan, name, price_monthly, max_users, max_trucks, max_drivers)
VALUES
  ('basic',        'Basic',        199, 5,  10, 10),
  ('intermediate', 'Intermediate', 349, 10, 25, 25),
  ('pro',          'Pro',          499, 25, 99, 99)
ON CONFLICT (plan) DO NOTHING;

-- =======================================================================
-- DONE
-- Schema ready. Next steps:
-- 1. Import data (export CSVs from Lovable, import here)
-- 2. Create 22 users in Authentication > Users
-- 3. Update Vercel env vars to point to this project
-- =======================================================================


-- ============================================
-- FASE 1: MULTI-TENANT BASE TABLES
-- ============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('master_admin', 'admin', 'accounting', 'dispatcher', 'driver');

-- 2. Subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('basic', 'intermediate', 'pro');

-- 3. Subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'pending_payment', 'suspended', 'cancelled');

-- 4. Tenants table (empresas)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  dba_name TEXT,
  dot_number TEXT,
  mc_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 5. Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_master_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plan subscription_plan NOT NULL DEFAULT 'basic',
  status subscription_status NOT NULL DEFAULT 'active',
  price_monthly NUMERIC NOT NULL DEFAULT 199,
  max_users INT NOT NULL DEFAULT 1,
  max_trucks INT NOT NULL DEFAULT 5,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_payment_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 8. Subscription payments table
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. Add tenant_id to ALL existing tables
-- ============================================

ALTER TABLE public.companies ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.loads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.trucks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.dispatchers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.load_stops ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.payment_adjustments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pod_documents ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ============================================
-- 10. Security definer helper functions
-- ============================================

-- Get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- Check if user is master admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_master_admin, false) FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- 11. RLS Policies for new tables
-- ============================================

-- TENANTS: master_admin sees all, users see their own tenant
CREATE POLICY "Master admin can do all on tenants"
  ON public.tenants FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Users can view own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

-- PROFILES: users see own profile, master_admin sees all
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_master_admin(auth.uid()) OR tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Master admin can manage profiles"
  ON public.profiles FOR ALL
  USING (public.is_master_admin(auth.uid()));

-- USER_ROLES: master_admin manages all, admins manage their tenant
CREATE POLICY "Master admin can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- SUBSCRIPTIONS: master_admin manages, tenant admin can view own
CREATE POLICY "Master admin can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- SUBSCRIPTION_PAYMENTS: master_admin manages, tenant admin can view own
CREATE POLICY "Master admin can manage subscription payments"
  ON public.subscription_payments FOR ALL
  USING (public.is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can view own payments"
  ON public.subscription_payments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============================================
-- 12. Update existing table RLS to include tenant isolation
-- ============================================

-- Drop old permissive policies on existing tables and replace with tenant-scoped ones

-- COMPANIES
DROP POLICY IF EXISTS "Authenticated users can read companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.companies;

CREATE POLICY "Tenant users can read companies" ON public.companies FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert companies" ON public.companies FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update companies" ON public.companies FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete companies" ON public.companies FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- LOADS
DROP POLICY IF EXISTS "Authenticated users can read loads" ON public.loads;
DROP POLICY IF EXISTS "Authenticated users can insert loads" ON public.loads;
DROP POLICY IF EXISTS "Authenticated users can update loads" ON public.loads;
DROP POLICY IF EXISTS "Authenticated users can delete loads" ON public.loads;

CREATE POLICY "Tenant users can read loads" ON public.loads FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert loads" ON public.loads FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update loads" ON public.loads FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete loads" ON public.loads FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- DRIVERS
DROP POLICY IF EXISTS "Authenticated users can read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can delete drivers" ON public.drivers;

CREATE POLICY "Tenant users can read drivers" ON public.drivers FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert drivers" ON public.drivers FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update drivers" ON public.drivers FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete drivers" ON public.drivers FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- TRUCKS
DROP POLICY IF EXISTS "Authenticated users can read trucks" ON public.trucks;
DROP POLICY IF EXISTS "Authenticated users can insert trucks" ON public.trucks;
DROP POLICY IF EXISTS "Authenticated users can update trucks" ON public.trucks;
DROP POLICY IF EXISTS "Authenticated users can delete trucks" ON public.trucks;

CREATE POLICY "Tenant users can read trucks" ON public.trucks FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert trucks" ON public.trucks FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update trucks" ON public.trucks FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete trucks" ON public.trucks FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- DISPATCHERS
DROP POLICY IF EXISTS "Authenticated users can read dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Authenticated users can insert dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Authenticated users can update dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Authenticated users can delete dispatchers" ON public.dispatchers;

CREATE POLICY "Tenant users can read dispatchers" ON public.dispatchers FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert dispatchers" ON public.dispatchers FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update dispatchers" ON public.dispatchers FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete dispatchers" ON public.dispatchers FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- PAYMENTS
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.payments;

CREATE POLICY "Tenant users can read payments" ON public.payments FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payments" ON public.payments FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update payments" ON public.payments FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete payments" ON public.payments FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- INVOICES
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;

CREATE POLICY "Tenant users can read invoices" ON public.invoices FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert invoices" ON public.invoices FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update invoices" ON public.invoices FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete invoices" ON public.invoices FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- LOAD_STOPS
DROP POLICY IF EXISTS "Authenticated users can read load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Authenticated users can insert load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Authenticated users can update load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Authenticated users can delete load_stops" ON public.load_stops;

CREATE POLICY "Tenant users can read load_stops" ON public.load_stops FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert load_stops" ON public.load_stops FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update load_stops" ON public.load_stops FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete load_stops" ON public.load_stops FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- PAYMENT_ADJUSTMENTS
DROP POLICY IF EXISTS "Authenticated users can read payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Authenticated users can insert payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Authenticated users can update payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Authenticated users can delete payment_adjustments" ON public.payment_adjustments;

CREATE POLICY "Tenant users can read payment_adjustments" ON public.payment_adjustments FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payment_adjustments" ON public.payment_adjustments FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can update payment_adjustments" ON public.payment_adjustments FOR UPDATE USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete payment_adjustments" ON public.payment_adjustments FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- POD_DOCUMENTS
DROP POLICY IF EXISTS "Authenticated users can read pod_documents" ON public.pod_documents;
DROP POLICY IF EXISTS "Authenticated users can insert pod_documents" ON public.pod_documents;
DROP POLICY IF EXISTS "Authenticated users can delete pod_documents" ON public.pod_documents;

CREATE POLICY "Tenant users can read pod_documents" ON public.pod_documents FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert pod_documents" ON public.pod_documents FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant users can delete pod_documents" ON public.pod_documents FOR DELETE USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============================================
-- 13. Auto-create profile on signup trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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

-- ============================================
-- 14. Updated_at triggers for new tables
-- ============================================

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 15. Indexes for performance
-- ============================================

CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions(tenant_id);
CREATE INDEX idx_companies_tenant_id ON public.companies(tenant_id);
CREATE INDEX idx_loads_tenant_id ON public.loads(tenant_id);
CREATE INDEX idx_drivers_tenant_id ON public.drivers(tenant_id);
CREATE INDEX idx_trucks_tenant_id ON public.trucks(tenant_id);
CREATE INDEX idx_dispatchers_tenant_id ON public.dispatchers(tenant_id);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_load_stops_tenant_id ON public.load_stops(tenant_id);
CREATE INDEX idx_payment_adjustments_tenant_id ON public.payment_adjustments(tenant_id);
CREATE INDEX idx_pod_documents_tenant_id ON public.pod_documents(tenant_id);

-- Allow insert on profiles for the trigger
CREATE POLICY "Allow trigger to create profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

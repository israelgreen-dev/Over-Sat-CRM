-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 010
-- Leads: a lightweight pre-pipeline stage. A lead holds just the essentials
-- (account, contact, country, short description) and can be converted into a
-- full opportunity with one click.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account        text NOT NULL,
  contact_name   text DEFAULT '',
  contact_email  text DEFAULT '',
  contact_phone  text DEFAULT '',
  country        text DEFAULT '',
  owner          text DEFAULT '',          -- sales manager display name
  status         text DEFAULT 'New',       -- New | Contacted | Qualified | Dropped | Converted
  description    text DEFAULT '',
  converted_opportunity_id text,           -- set when converted
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Reuse the shared updated_at trigger function from migration 008
DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS — same model as opportunities ────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_read"          ON public.leads;
DROP POLICY IF EXISTS "leads_write_admin"   ON public.leads;
DROP POLICY IF EXISTS "leads_write_manager" ON public.leads;

CREATE POLICY "leads_read"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "leads_write_admin"
  ON public.leads FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

CREATE POLICY "leads_write_manager"
  ON public.leads FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 001
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. CRM Settings table ─────────────────────────────────────────────────────
-- Stores all configuration (managers, products, targets, etc.) that was
-- previously only in localStorage. Single-row per installation.

CREATE TABLE IF NOT EXISTS public.crm_settings (
  id                          integer PRIMARY KEY DEFAULT 1,
  managers                    jsonb DEFAULT '[]'::jsonb,
  products                    jsonb DEFAULT '[]'::jsonb,
  head_of_sales               text  DEFAULT '',
  partners                    jsonb DEFAULT '[]'::jsonb,
  targets_by_year             jsonb DEFAULT '{}'::jsonb,
  quarterly_targets_by_year   jsonb DEFAULT '{}'::jsonb,
  product_target_rows_by_year jsonb DEFAULT '{}'::jsonb,
  updated_at                  timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row if it doesn't exist yet
INSERT INTO public.crm_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS on crm_settings
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can READ settings (needed to render the app)
CREATE POLICY "crm_settings_read"
  ON public.crm_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admin / head_of_sales can WRITE settings
CREATE POLICY "crm_settings_write"
  ON public.crm_settings FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

CREATE POLICY "crm_settings_upsert"
  ON public.crm_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );


-- ── 2. Opportunities RLS ──────────────────────────────────────────────────────
-- The opportunities table should already exist. These policies enforce that:
--   • All authenticated users can read all opportunities (needed for analytics)
--   • Admin / HoS can create, update, delete any opportunity
--   • Sales Managers can only create/update/delete their own opportunities
--   • Partners get read-only access (no write policies for their role)

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to allow safe re-runs
DROP POLICY IF EXISTS "opps_read"          ON public.opportunities;
DROP POLICY IF EXISTS "opps_write_admin"   ON public.opportunities;
DROP POLICY IF EXISTS "opps_write_manager" ON public.opportunities;

-- READ: all authenticated users
CREATE POLICY "opps_read"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (true);

-- WRITE: admin and head_of_sales — full access
CREATE POLICY "opps_write_admin"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

-- WRITE: manager — own opportunities only (matched by owner = their name)
CREATE POLICY "opps_write_manager"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  );

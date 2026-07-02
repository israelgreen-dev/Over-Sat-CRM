-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 007  (SECURITY — run before next deploy)
--
-- Roles previously lived in user_metadata, which any signed-in user can edit
-- about themselves (supabase.auth.updateUser). That let any user self-assign
-- the admin role. This migration:
--   1. Copies each user's role into app_metadata (server-only, not editable
--      by the user).
--   2. Rewrites every RLS policy to trust app_metadata instead.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Copy existing roles from user_metadata → app_metadata ────────────────
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data ? 'role'
  AND (raw_app_meta_data->>'role') IS DISTINCT FROM (raw_user_meta_data->>'role');

-- ── 2. crm_settings policies → app_metadata role ────────────────────────────
DROP POLICY IF EXISTS "crm_settings_write"  ON public.crm_settings;
DROP POLICY IF EXISTS "crm_settings_upsert" ON public.crm_settings;

CREATE POLICY "crm_settings_write"
  ON public.crm_settings FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

CREATE POLICY "crm_settings_upsert"
  ON public.crm_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

-- ── 3. opportunities policies → app_metadata role ───────────────────────────
DROP POLICY IF EXISTS "opps_write_admin"   ON public.opportunities;
DROP POLICY IF EXISTS "opps_write_manager" ON public.opportunities;

CREATE POLICY "opps_write_admin"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

-- Managers may write only their own deals. The owner match still uses the
-- display name from user_metadata; a user could rename themselves, but the
-- role gate above is what grants write access at all, and names are visible
-- to admins in the Users tab.
CREATE POLICY "opps_write_manager"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'user_metadata' ->> 'name')
  );

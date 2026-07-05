-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 014  (SECURITY — fixes linter findings)
--
-- RLS matched deal/lead ownership by the display name in user_metadata,
-- which users can edit about themselves — a manager could rename themselves
-- into a colleague's pipeline. Names now live in app_metadata (server-only,
-- admin-assigned), like roles since migration 007.
--
-- NOTE: managers should sign out and back in after this runs so their
-- session token picks up the app_metadata name (tokens also refresh
-- automatically within the hour).
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Copy existing display names into app_metadata ────────────────────────
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('name', raw_user_meta_data->>'name')
WHERE raw_user_meta_data ? 'name'
  AND (raw_app_meta_data->>'name') IS DISTINCT FROM (raw_user_meta_data->>'name');

-- ── 2. Opportunities: manager ownership via app_metadata name ───────────────
DROP POLICY IF EXISTS "opps_write_manager" ON public.opportunities;
CREATE POLICY "opps_write_manager"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'app_metadata' ->> 'name')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'app_metadata' ->> 'name')
  );

-- ── 3. Leads: manager ownership via app_metadata name ───────────────────────
DROP POLICY IF EXISTS "leads_write_manager" ON public.leads;
CREATE POLICY "leads_write_manager"
  ON public.leads FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'app_metadata' ->> 'name')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND owner = (auth.jwt() -> 'app_metadata' ->> 'name')
  );

-- ── 4. Audit trail: actor label prefers the server-controlled name ──────────
CREATE OR REPLACE FUNCTION public.log_opportunity_audit()
RETURNS trigger
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actor   text;
  diff    jsonb := '{}'::jsonb;
  col     text;
  tracked text[] := ARRAY[
    'name','customer_name','owner','stage','status','product','country',
    'currency','close_date','value','final_win_value','probability',
    'loss_reason','loss_description','opportunity_type'
  ];
  old_row jsonb;
  new_row jsonb;
BEGIN
  actor := COALESCE(
    auth.jwt() -> 'app_metadata'  ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() ->> 'email',
    'system'
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.opportunity_audit (opportunity_id, action, changed_by, changes)
    VALUES (NEW.id::text, 'INSERT', actor,
            jsonb_build_object('name', jsonb_build_object('old', null, 'new', NEW.name)));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.opportunity_audit (opportunity_id, action, changed_by, changes)
    VALUES (OLD.id::text, 'DELETE', actor,
            jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', null)));
    RETURN OLD;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);
  FOREACH col IN ARRAY tracked LOOP
    IF (old_row -> col) IS DISTINCT FROM (new_row -> col) THEN
      diff := diff || jsonb_build_object(
        col, jsonb_build_object('old', old_row -> col, 'new', new_row -> col)
      );
    END IF;
  END LOOP;

  IF diff <> '{}'::jsonb THEN
    INSERT INTO public.opportunity_audit (opportunity_id, action, changed_by, changes)
    VALUES (NEW.id::text, 'UPDATE', actor, diff);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

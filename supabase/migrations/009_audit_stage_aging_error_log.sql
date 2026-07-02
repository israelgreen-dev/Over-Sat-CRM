-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 009
-- 1. Audit trail: every change to an opportunity is recorded (who/when/what).
-- 2. Stage aging: stage_changed_at tracks how long a deal sits in its stage.
-- 3. Client error log: the app reports UI crashes here (self-hosted
--    error monitoring — no external service needed).
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1a. Audit table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_audit (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opportunity_id text        NOT NULL,
  action         text        NOT NULL,             -- INSERT | UPDATE | DELETE
  changed_by     text,                             -- display name from the JWT
  changed_at     timestamptz NOT NULL DEFAULT now(),
  changes        jsonb       NOT NULL DEFAULT '{}'::jsonb  -- { field: { old, new } }
);

CREATE INDEX IF NOT EXISTS opportunity_audit_opp_idx
  ON public.opportunity_audit (opportunity_id, changed_at DESC);

ALTER TABLE public.opportunity_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_read" ON public.opportunity_audit;
CREATE POLICY "audit_read"
  ON public.opportunity_audit FOR SELECT
  TO authenticated
  USING (true);
-- No INSERT/UPDATE/DELETE policies: only the trigger (definer) writes here.

-- ── 1b. Audit trigger ────────────────────────────────────────────────────────
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
    'loss_reason','loss_description'
  ];
  old_row jsonb;
  new_row jsonb;
BEGIN
  actor := COALESCE(
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

  -- UPDATE: diff only the tracked, human-relevant columns
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

DROP TRIGGER IF EXISTS opportunities_audit ON public.opportunities;
CREATE TRIGGER opportunities_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_opportunity_audit();

-- ── 2. Stage aging ───────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;

UPDATE public.opportunities
  SET stage_changed_at = COALESCE(stage_changed_at, created_at, now())
  WHERE stage_changed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_stage_changed_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_stage_changed ON public.opportunities;
CREATE TRIGGER opportunities_stage_changed
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_stage_changed_at();

-- ── 3. Client error log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_errors (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_name   text,
  message     text,
  stack       text,
  url         text,
  user_agent  text
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_errors_insert" ON public.client_errors;
CREATE POLICY "client_errors_insert"
  ON public.client_errors FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_errors_read" ON public.client_errors;
CREATE POLICY "client_errors_read"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales')
  );

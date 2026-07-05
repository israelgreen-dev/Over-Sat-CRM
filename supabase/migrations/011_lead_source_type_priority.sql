-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 011
-- Lead enrichment: Source, Opportunity Type, Priority, Website.
-- Opportunity Type also lands on opportunities (carried over on conversion)
-- and is added to the audit trail's tracked columns.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source           text DEFAULT '',
  ADD COLUMN IF NOT EXISTS opportunity_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority         text DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS website          text DEFAULT '';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type text DEFAULT '';

-- Refresh the audit trigger so opportunity_type changes are recorded too
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

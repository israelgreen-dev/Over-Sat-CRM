-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 015
-- Email notifications groundwork:
--   1. notification_settings column on crm_settings (configured in Settings).
--   2. lead_audit table + trigger — records create/update/delete on leads,
--      mirroring the opportunity audit (feeds digests and the History view).
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Notification settings storage ────────────────────────────────────────
ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{}'::jsonb;

-- ── 2. Lead audit table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id    text        NOT NULL,
  action     text        NOT NULL,             -- INSERT | UPDATE | DELETE
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changes    jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS lead_audit_time_idx
  ON public.lead_audit (changed_at DESC);

ALTER TABLE public.lead_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_audit_read" ON public.lead_audit;
CREATE POLICY "lead_audit_read"
  ON public.lead_audit FOR SELECT
  TO authenticated
  USING (true);
-- No write policies: only the trigger (definer) writes here.

-- ── 3. Lead audit trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_lead_audit()
RETURNS trigger
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actor   text;
  diff    jsonb := '{}'::jsonb;
  col     text;
  tracked text[] := ARRAY[
    'account','contact_name','contact_email','country','owner','status',
    'source','opportunity_type','priority','description','website'
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
    INSERT INTO public.lead_audit (lead_id, action, changed_by, changes)
    VALUES (NEW.id::text, 'INSERT', actor,
            jsonb_build_object('account', jsonb_build_object('old', null, 'new', NEW.account)));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_audit (lead_id, action, changed_by, changes)
    VALUES (OLD.id::text, 'DELETE', actor,
            jsonb_build_object('account', jsonb_build_object('old', OLD.account, 'new', null)));
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
    -- Keep the account name on every entry so digests can show it.
    diff := diff || jsonb_build_object('_account', to_jsonb(NEW.account));
    INSERT INTO public.lead_audit (lead_id, action, changed_by, changes)
    VALUES (NEW.id::text, 'UPDATE', actor, diff);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_audit ON public.leads;
CREATE TRIGGER leads_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 008
-- "Last updated" timestamps, maintained by the database itself.
--
-- A BEFORE UPDATE trigger stamps updated_at = now() on every change, so the
-- timestamp is correct regardless of which client or code path performed the
-- update (and can't be forged by a client).
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Opportunities ────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows from created_at so nothing shows empty
UPDATE public.opportunities
  SET updated_at = COALESCE(updated_at, created_at, now())
  WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS opportunities_set_updated_at ON public.opportunities;
CREATE TRIGGER opportunities_set_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Opportunity contacts ─────────────────────────────────────────────────────
ALTER TABLE public.opportunity_contacts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.opportunity_contacts
  SET updated_at = COALESCE(updated_at, created_at, now())
  WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.opportunity_contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.opportunity_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

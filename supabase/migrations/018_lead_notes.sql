-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 018
-- Lead notes: same timestamped-notes mechanism opportunities have.
--
-- 1. lead_notes table + RLS (same open model as opportunity notes, 003).
-- 2. One-time data migration: each lead's existing free-text description
--    becomes its first note (dated to the lead's creation). Idempotent —
--    leads that already have notes are skipped, so re-running is safe.
--    The leads.description column is kept (legacy display fallback).
--
-- Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON public.lead_notes (lead_id);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_notes_read"   ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_insert" ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_update" ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_delete" ON public.lead_notes;

CREATE POLICY "lead_notes_read"
  ON public.lead_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lead_notes_insert"
  ON public.lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "lead_notes_update"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "lead_notes_delete"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (true);

-- Existing descriptions become each lead's first note (keep the data).
INSERT INTO public.lead_notes (lead_id, content, created_at)
SELECT l.id, l.description, l.created_at
FROM public.leads l
WHERE COALESCE(TRIM(l.description), '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.lead_notes n WHERE n.lead_id = l.id);

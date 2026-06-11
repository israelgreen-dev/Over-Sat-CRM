-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 003
-- RLS policies for notes, opportunity contacts, and opportunity documents.
--
-- Migration 001 only created policies for crm_settings and opportunities.
-- The notes / opportunity_contacts tables have RLS enabled but no policies,
-- so every INSERT fails with:
--   "new row violates row-level security policy for table notes"
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Notes ──────────────────────────────────────────────────────────────────
-- Any signed-in user can read and add notes (the app lets every role attach
-- notes to opportunities they can open).

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_read"   ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_read"
  ON public.notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "notes_insert"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "notes_update"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "notes_delete"
  ON public.notes FOR DELETE
  TO authenticated
  USING (true);


-- ── 2. Opportunity contacts ───────────────────────────────────────────────────
-- Same model as notes: the Contacts tab lets users add / edit / delete.

ALTER TABLE public.opportunity_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_read"   ON public.opportunity_contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.opportunity_contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.opportunity_contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.opportunity_contacts;

CREATE POLICY "contacts_read"
  ON public.opportunity_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contacts_insert"
  ON public.opportunity_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "contacts_update"
  ON public.opportunity_contacts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "contacts_delete"
  ON public.opportunity_contacts FOR DELETE
  TO authenticated
  USING (true);


-- ── 3. Documents storage bucket ───────────────────────────────────────────────
-- The Documents tab uploads to the 'opportunity-docs' bucket. These policies
-- let signed-in users list, upload, download, and delete files in that bucket.
-- If this section errors with "must be owner of table objects", create the
-- same four policies from Dashboard → Storage → opportunity-docs → Policies.

DROP POLICY IF EXISTS "opportunity_docs_read"   ON storage.objects;
DROP POLICY IF EXISTS "opportunity_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "opportunity_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "opportunity_docs_delete" ON storage.objects;

CREATE POLICY "opportunity_docs_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'opportunity-docs');

CREATE POLICY "opportunity_docs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'opportunity-docs');

CREATE POLICY "opportunity_docs_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'opportunity-docs');

CREATE POLICY "opportunity_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'opportunity-docs');

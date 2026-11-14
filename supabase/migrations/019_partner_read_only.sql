-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 019
-- Partners are strictly view-only, enforced at the database.
--
-- Leads and opportunities were already safe (write policies name the roles
-- that may write; partner is not among them). But the side tables created in
-- 003/018 allowed ANY authenticated user to write — including partners. This
-- replaces their write policies: read stays open to all signed-in users,
-- writes require admin / head_of_sales / manager.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Opportunity notes
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "notes_update" ON public.notes FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "notes_delete" ON public.notes FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));

-- Lead notes
DROP POLICY IF EXISTS "lead_notes_insert" ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_update" ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_delete" ON public.lead_notes;
CREATE POLICY "lead_notes_insert" ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "lead_notes_update" ON public.lead_notes FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "lead_notes_delete" ON public.lead_notes FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));

-- Opportunity contacts
DROP POLICY IF EXISTS "contacts_insert" ON public.opportunity_contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.opportunity_contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.opportunity_contacts;
CREATE POLICY "contacts_insert" ON public.opportunity_contacts FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "contacts_update" ON public.opportunity_contacts FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));
CREATE POLICY "contacts_delete" ON public.opportunity_contacts FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'head_of_sales', 'manager'));

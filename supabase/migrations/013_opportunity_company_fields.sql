-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 013
-- Opportunities gain the same company/qualification fields as leads
-- (website, lead source, priority) so both entry paths capture equal data.
-- Carried over automatically when a lead is converted.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS website  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS source   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Medium';

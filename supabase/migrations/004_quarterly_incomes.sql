-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 004
-- Per-opportunity planned income by quarter, e.g. {"Q3-2026": 250000, ...}.
-- Powers the Projection tab (sales projection over the next 8 quarters).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS quarterly_incomes jsonb DEFAULT '{}'::jsonb;

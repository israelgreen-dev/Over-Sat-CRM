-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 002
-- Adds editable per-stage probability defaults and per-manager colors.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS probability_defaults jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manager_colors       jsonb DEFAULT '{}'::jsonb;

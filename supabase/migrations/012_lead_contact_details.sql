-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 012
-- Lead contact enrichment: job title and LinkedIn profile.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_title    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_linkedin text DEFAULT '';

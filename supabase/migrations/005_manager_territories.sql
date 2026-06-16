-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 005
-- Adds free-text per-manager territories (stored as { managerName: territory }).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS manager_territories jsonb DEFAULT '{}'::jsonb;

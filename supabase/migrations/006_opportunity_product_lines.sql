-- ─────────────────────────────────────────────────────────────────────────────
-- Over-Sat CRM — Supabase Migration 006
-- Lets an opportunity consist of multiple products, each with its own
-- quantity and unit price. Stored as an array of line items:
--   [{ "id": "...", "product": "Camelon", "quantity": 5, "price": 100000 }, ...]
-- The opportunity's `value` column remains the sum of the line totals, so all
-- existing value-based logic (analytics, weighted value, etc.) keeps working.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS product_lines jsonb DEFAULT '[]'::jsonb;

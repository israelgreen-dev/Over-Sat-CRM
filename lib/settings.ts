/**
 * settings.ts
 * Unified CRM settings service.
 *
 * Strategy:
 *  - Load:  Supabase first (source of truth across devices/users).
 *           Falls back to localStorage if Supabase is unavailable.
 *  - Save:  Writes to localStorage immediately (fast, no latency for the user)
 *           AND syncs to Supabase in the background.
 *
 * This means settings survive cache clears, work on any device the admin
 * logs in from, and degrade gracefully if Supabase is temporarily down.
 */

import { supabase } from './supabase'
import type { NotificationConfig } from './notification-types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuarterlyData = { q1: number; q2: number; q3: number; q4: number }

export type ProductTargetRow = {
  id: string
  product: string
  price: number
  quantity: number
  probability: number
  description?: string
}

export type CRMSettings = {
  managers:                   string[]
  products:                   string[]
  headOfSales:                string
  partners:                   string[]
  targetsByYear:              Record<string, Record<string, number>>
  quarterlyTargetsByYear:     Record<string, Record<string, QuarterlyData>>
  productTargetRowsByYear:    Record<string, Record<string, ProductTargetRow[]>>
  probabilityDefaults:        Record<string, number>
  managerColors:              Record<string, string>
  managerTerritories:         Record<string, string>
  notificationSettings:       NotificationConfig
}

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS = {
  managers:                'oversat_crm_managers',
  products:                'oversat_crm_products',
  headOfSales:             'oversat_crm_head_of_sales',
  partners:                'oversat_crm_partners',
  targetsByYear:           'oversat_crm_targets_by_year',
  quarterlyTargetsByYear:  'oversat_crm_quarterly_targets_by_year',
  productTargetRowsByYear: 'oversat_crm_product_target_rows_by_year',
  probabilityDefaults:     'oversat_crm_probability_defaults',
  managerColors:           'oversat_crm_manager_colors',
  managerTerritories:      'oversat_crm_manager_territories',
  notificationSettings:    'oversat_crm_notification_settings',
  legacyTargets:           'oversat_crm_manager_targets', // v1 key — migration only
} as const

// ── localStorage helpers ──────────────────────────────────────────────────────

function readLS(): Partial<CRMSettings> {
  try {
    const out: Partial<CRMSettings> = {}
    const m   = localStorage.getItem(LS.managers);                if (m)   out.managers                = JSON.parse(m)
    const p   = localStorage.getItem(LS.products);                if (p)   out.products                = JSON.parse(p)
    const h   = localStorage.getItem(LS.headOfSales);             if (h)   out.headOfSales             = h
    const pa  = localStorage.getItem(LS.partners);                if (pa)  out.partners                = JSON.parse(pa)
    const tby = localStorage.getItem(LS.targetsByYear);           if (tby) out.targetsByYear           = JSON.parse(tby)
    const qty = localStorage.getItem(LS.quarterlyTargetsByYear);  if (qty) out.quarterlyTargetsByYear  = JSON.parse(qty)
    const ptr = localStorage.getItem(LS.productTargetRowsByYear); if (ptr) out.productTargetRowsByYear = JSON.parse(ptr)
    const pd  = localStorage.getItem(LS.probabilityDefaults);     if (pd)  out.probabilityDefaults     = JSON.parse(pd)
    const mc  = localStorage.getItem(LS.managerColors);           if (mc)  out.managerColors           = JSON.parse(mc)
    const mt  = localStorage.getItem(LS.managerTerritories);      if (mt)  out.managerTerritories      = JSON.parse(mt)
    const ns  = localStorage.getItem(LS.notificationSettings);    if (ns)  out.notificationSettings    = JSON.parse(ns)
    return out
  } catch {
    return {}
  }
}

function writeLS(s: Partial<CRMSettings>): void {
  try {
    if (s.managers                !== undefined) localStorage.setItem(LS.managers,                JSON.stringify(s.managers))
    if (s.products                !== undefined) localStorage.setItem(LS.products,                JSON.stringify(s.products))
    if (s.headOfSales             !== undefined) localStorage.setItem(LS.headOfSales,             s.headOfSales)
    if (s.partners                !== undefined) localStorage.setItem(LS.partners,                JSON.stringify(s.partners))
    if (s.targetsByYear           !== undefined) localStorage.setItem(LS.targetsByYear,           JSON.stringify(s.targetsByYear))
    if (s.quarterlyTargetsByYear  !== undefined) localStorage.setItem(LS.quarterlyTargetsByYear,  JSON.stringify(s.quarterlyTargetsByYear))
    if (s.productTargetRowsByYear !== undefined) localStorage.setItem(LS.productTargetRowsByYear, JSON.stringify(s.productTargetRowsByYear))
    if (s.probabilityDefaults     !== undefined) localStorage.setItem(LS.probabilityDefaults,     JSON.stringify(s.probabilityDefaults))
    if (s.managerColors           !== undefined) localStorage.setItem(LS.managerColors,           JSON.stringify(s.managerColors))
    if (s.managerTerritories      !== undefined) localStorage.setItem(LS.managerTerritories,      JSON.stringify(s.managerTerritories))
    if (s.notificationSettings    !== undefined) localStorage.setItem(LS.notificationSettings,    JSON.stringify(s.notificationSettings))
  } catch {
    // Ignore quota errors
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load settings — Supabase is the source of truth; localStorage is the cache.
 * Always resolves (never throws).
 */
export async function loadSettings(): Promise<Partial<CRMSettings>> {
  const ls = readLS()

  try {
    const { data, error } = await supabase
      .from('crm_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error || !data) return ls // Supabase unavailable — use local cache

    const remote: Partial<CRMSettings> = {
      managers:                data.managers                   ?? ls.managers,
      products:                data.products                   ?? ls.products,
      headOfSales:             data.head_of_sales              ?? ls.headOfSales ?? '',
      partners:                data.partners                   ?? ls.partners,
      targetsByYear:           data.targets_by_year            ?? ls.targetsByYear,
      quarterlyTargetsByYear:  data.quarterly_targets_by_year  ?? ls.quarterlyTargetsByYear,
      productTargetRowsByYear: data.product_target_rows_by_year ?? ls.productTargetRowsByYear,
      probabilityDefaults:     data.probability_defaults        ?? ls.probabilityDefaults,
      managerColors:           data.manager_colors              ?? ls.managerColors,
      managerTerritories:      data.manager_territories         ?? ls.managerTerritories,
      notificationSettings:    data.notification_settings       ?? ls.notificationSettings,
    }

    writeLS(remote) // Refresh local cache from Supabase
    return remote
  } catch {
    return ls
  }
}

/**
 * Save a partial settings update.
 * Writes to localStorage immediately, then syncs to Supabase in the background.
 * Non-fatal if Supabase is unavailable.
 */
export async function saveSettings(s: Partial<CRMSettings>): Promise<void> {
  writeLS(s) // Fast — no await

  try {
    const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() }
    if (s.managers                !== undefined) row.managers                    = s.managers
    if (s.products                !== undefined) row.products                    = s.products
    if (s.headOfSales             !== undefined) row.head_of_sales               = s.headOfSales
    if (s.partners                !== undefined) row.partners                    = s.partners
    if (s.targetsByYear           !== undefined) row.targets_by_year             = s.targetsByYear
    if (s.quarterlyTargetsByYear  !== undefined) row.quarterly_targets_by_year   = s.quarterlyTargetsByYear
    if (s.productTargetRowsByYear !== undefined) row.product_target_rows_by_year = s.productTargetRowsByYear
    if (s.probabilityDefaults     !== undefined) row.probability_defaults        = s.probabilityDefaults
    if (s.managerColors           !== undefined) row.manager_colors              = s.managerColors
    if (s.managerTerritories      !== undefined) row.manager_territories         = s.managerTerritories
    if (s.notificationSettings    !== undefined) row.notification_settings       = s.notificationSettings

    // Progressive fallback: strip columns missing from older DB schemas
    // (migration 002 adds probability_defaults / manager_colors; 005 adds
    // manager_territories) so one unknown column doesn't block the rest of
    // the settings from syncing.
    const payload = { ...row }
    for (let attempt = 0; attempt < 6; attempt++) {
      const { error } = await supabase.from('crm_settings').upsert(payload)
      if (!error) break
      if (error.message?.includes('probability_defaults')) { delete payload.probability_defaults; continue }
      if (error.message?.includes('manager_colors'))       { delete payload.manager_colors;       continue }
      if (error.message?.includes('manager_territories'))  { delete payload.manager_territories;  continue }
      if (error.message?.includes('notification_settings')) { delete payload.notification_settings; continue }
      break
    }
  } catch {
    // Background sync failure is non-fatal; localStorage already updated
  }
}

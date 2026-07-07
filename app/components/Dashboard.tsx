'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toUSD } from '@/lib/currency'
import { type Opportunity, DEFAULT_PROBABILITY } from './OpportunitiesTable'
import DashboardAnalytics, { MANAGER_TARGETS } from './DashboardAnalytics'
import ManagersTab from './ManagersTab'
import LeadsTab, { type Lead } from './LeadsTab'
import PipelineTab from './PipelineTab'
import SettingsTab from './SettingsTab'
import AnalyticsTab from './AnalyticsTab'
import TargetsTab, { type QuarterlyData, type ProductTargetRow } from './TargetsTab'
import ProjectionTab from './ProjectionTab'
import UsersTab from './UsersTab'
import ErrorBoundary from './ErrorBoundary'
import LoginScreen from './LoginScreen'
import SetupScreen from './SetupScreen'
import ResetPasswordScreen from './ResetPasswordScreen'
import { loadSettings, saveSettings } from '@/lib/settings'
import { DEFAULT_NOTIFICATION_CONFIG, normalizeNotificationConfig, type NotificationConfig } from '@/lib/notification-types'

// ── Module-level constants ─────────────────────────────────────────────────────
// CURRENT_YEAR is evaluated once at module load — never changes within a session,
// and avoids the new Date() SSR/client hydration mismatch in useState initialisers.
const HEAD_OF_SALES    = 'head_of_sales'
const MANAGER_NAMES    = Object.keys(MANAGER_TARGETS)
const DEFAULT_PRODUCTS = ['Python5', 'Python7', 'Mantis10', 'Rigel', 'Griffin', 'Scorpion', 'Cameleon']
const COLOR_PALETTE    = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']
const CURRENT_YEAR     = String(new Date().getFullYear())
// Sentinel year value: shows opportunities across every year and aggregates
// per-year targets. Used by the header year selector and Analytics.
const ALL_YEARS        = 'All Years'

type Tab = 'Dashboard' | 'Sales Managers' | 'Leads' | 'Opportunities' | 'Analytics' | 'Projection' | 'Targets' | 'Settings'

// Per-area accent: the active pill takes the section's color; inactive tabs
// show it as a small dot. Matches each area's accents elsewhere in the app
// (Leads/emerald like "+ New Lead", Opportunities/orange, Targets/amber…).
const TAB_STYLE: Record<Tab, { active: string; dot: string }> = {
  'Dashboard':      { active: 'bg-slate-800 text-white shadow-sm',   dot: 'bg-slate-500'   },
  'Sales Managers': { active: 'bg-blue-600 text-white shadow-sm',    dot: 'bg-blue-400'    },
  'Leads':          { active: 'bg-emerald-600 text-white shadow-sm', dot: 'bg-emerald-400' },
  'Opportunities':  { active: 'bg-orange-500 text-white shadow-sm',  dot: 'bg-orange-400'  },
  'Analytics':      { active: 'bg-indigo-600 text-white shadow-sm',  dot: 'bg-indigo-400'  },
  'Projection':     { active: 'bg-violet-600 text-white shadow-sm',  dot: 'bg-violet-400'  },
  'Targets':        { active: 'bg-amber-500 text-white shadow-sm',   dot: 'bg-amber-400'   },
  'Settings':       { active: 'bg-gray-600 text-white shadow-sm',    dot: 'bg-gray-400'    },
}

type UserProfile = {
  id: string
  name: string
  role: 'admin' | 'head_of_sales' | 'manager' | 'partner'
  email: string
}

// Hoisted so the Intl object is created once, not on every render.
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
function fmtCurrency(n: number) { return currencyFmt.format(n) }

// A manager's annual target is derived from their product target rows — the
// single source of truth shared by the Targets tab and all analytics. Stored
// target numbers without backing product rows therefore never show up.
function weightedFromRows(rows: ProductTargetRow[] | undefined): number {
  return Math.round((rows ?? []).reduce((s, r) => s + (r.price || 0) * (r.quantity || 0) * ((r.probability || 0) / 100), 0))
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  // True while the user arrived via a password-recovery link and must set a
  // new password before entering the app.
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // Declared before the auth effect below, which sets it when a session loads.
  const [viewAs, setViewAs]           = useState<string>(HEAD_OF_SALES)

  useEffect(() => {
    // Role comes from app_metadata (server-assigned, migration 007); the
    // user_metadata fallback only covers accounts created before the move —
    // real enforcement happens in RLS and the API routes either way.
    type SessionUser = {
      id: string
      email?: string
      user_metadata: Record<string, string>
      app_metadata?: Record<string, unknown>
    }
    async function loadProfile(user: SessionUser) {
      const p: UserProfile = {
        id: user.id,
        email: user.email ?? '',
        // app_metadata is authoritative (admin-assigned, matches RLS
        // ownership); user_metadata only as legacy/display fallback.
        name: ((user.app_metadata?.name as string) ?? user.user_metadata?.name ?? ''),
        role: ((user.app_metadata?.role as string) ?? user.user_metadata?.role ?? '') as UserProfile['role'],
      }
      setProfile(p)
      if (p.role === 'manager' || p.role === 'partner') {
        setViewAs(p.name)
      } else {
        setViewAs(HEAD_OF_SALES)
      }
      setAuthLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user)
      else setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (session?.user) loadProfile(session.user)
      else { setProfile(null); setAuthLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setViewAs(HEAD_OF_SALES)
  }, [])

  const isAdmin      = profile?.role === 'admin'
  const isLockedView = profile?.role === 'manager' || profile?.role === 'partner'

  const [activeTab, setActiveTab]     = useState<Tab>('Dashboard')
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [viewerOpen, setViewerOpen]   = useState(false)
  const viewerRef                     = useRef<HTMLDivElement>(null)

  // ── Live opportunities (fetched after login; kept in sync with edits) ─────
  // Fetched client-side through the anon key + session so RLS applies and no
  // pipeline data is ever embedded in the page before authentication.
  const [liveOpps, setLiveOpps]         = useState<Opportunity[]>([])
  const [oppsLoading, setOppsLoading]   = useState(true)
  const [oppsError, setOppsError]       = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.role) return
    let cancelled = false
    setOppsLoading(true)
    setOppsError(null)
    supabase
      .from('opportunities')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setOppsError(error.message)
        else setLiveOpps((data ?? []) as Opportunity[])
        setOppsLoading(false)
      })
    return () => { cancelled = true }
  }, [profile?.role, profile?.id])

  // ── Leads (owned here so the banner and Analytics stay in sync) ──────────
  const [leads, setLeads]             = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError]   = useState<string | null>(null)

  const reloadLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) { setLeadsError(error.message); setLeads([]) }
    else       { setLeadsError(null); setLeads((data ?? []) as Lead[]) }
    setLeadsLoading(false)
  }, [])

  useEffect(() => {
    if (profile?.role) reloadLeads()
  }, [profile?.role, profile?.id, reloadLeads])

  const handleOppUpdated = useCallback((updated: Opportunity) => {
    setLiveOpps((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }, [])

  const handleOppAdded = useCallback((newOpp: Opportunity) => {
    setLiveOpps((prev) => [newOpp, ...prev])
  }, [])

  const handleOppDeleted = useCallback((id: string | number) => {
    setLiveOpps((prev) => prev.filter((o) => o.id !== id))
  }, [])


  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (viewerRef.current && !viewerRef.current.contains(e.target as Node)) {
        setViewerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Editable lists (Settings) ─────────────────────────────────────────────
  const [managers, setManagers]       = useState<string[]>([...MANAGER_NAMES])
  const [products, setProducts]       = useState<string[]>(DEFAULT_PRODUCTS)
  const [headOfSales, setHeadOfSales] = useState<string>(MANAGER_NAMES[0] ?? '')
  const [partners, setPartners]       = useState<string[]>([])
  const [probabilityDefaults, setProbabilityDefaults] = useState<Record<string, number>>({ ...DEFAULT_PROBABILITY })
  // Explicit per-manager color picks from Settings; managers without a pick
  // fall back to the palette (by list position) in the managerColors memo.
  const [managerColorOverrides, setManagerColorOverrides] = useState<Record<string, string>>({})
  // Free-text territory per manager (keyed by manager name).
  const [managerTerritories, setManagerTerritories] = useState<Record<string, string>>({})
  // Email notification preferences — Admin and Head of Sales configured separately.
  const [notificationSettings, setNotificationSettings] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG)

  // ── Year selector ─────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR)

  // ── Per-year targets ──────────────────────────────────────────────────────
  const [targetsByYear, setTargetsByYear] = useState<Record<string, Record<string, number>>>({
    [CURRENT_YEAR]: { ...MANAGER_TARGETS },
  })

  // ── Per-year quarterly targets ────────────────────────────────────────────
  const [quarterlyTargetsByYear, setQuarterlyTargetsByYear] = useState<Record<string, Record<string, QuarterlyData>>>({})

  // ── Per-year, per-manager product target rows ─────────────────────────────
  const [productTargetRowsByYear, setProductTargetRowsByYear] = useState<Record<string, Record<string, ProductTargetRow[]>>>({})

  // Targets are derived from each manager's product target rows (the Targets
  // tab's source of truth), so Analytics always matches what the Targets tab
  // shows. For "All Years" we sum each manager's target across every year.
  const targetsForYear = useCallback((year: string): Record<string, number> => {
    const byManager = productTargetRowsByYear[year] ?? {}
    const out: Record<string, number> = {}
    for (const [m, rows] of Object.entries(byManager)) {
      const t = weightedFromRows(rows)
      if (t > 0) out[m] = t
    }
    return out
  }, [productTargetRowsByYear])

  const managerTargets = useMemo(() => {
    if (selectedYear === ALL_YEARS) {
      const agg: Record<string, number> = {}
      for (const year of Object.keys(productTargetRowsByYear)) {
        for (const [m, v] of Object.entries(targetsForYear(year))) agg[m] = (agg[m] ?? 0) + v
      }
      return agg
    }
    return targetsForYear(selectedYear)
  }, [productTargetRowsByYear, selectedYear, targetsForYear])

  const setManagerTargets = useCallback(
    (v: Record<string, number>) =>
      setTargetsByYear((prev) => ({ ...prev, [selectedYear]: v })),
    [selectedYear],
  )

  // ── Load settings — Supabase first, localStorage fallback ────────────────
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => {
      if (s.managers)                setManagers(s.managers)
      if (s.products)                setProducts(s.products)
      if (s.headOfSales !== undefined) setHeadOfSales(s.headOfSales)
      if (s.partners)                setPartners(s.partners)
      if (s.targetsByYear)           setTargetsByYear(s.targetsByYear)
      else {
        // Legacy migration: v1 stored targets under a different key
        try {
          const t = localStorage.getItem('oversat_crm_manager_targets')
          if (t) setTargetsByYear({ [CURRENT_YEAR]: JSON.parse(t) })
        } catch {}
      }
      if (s.quarterlyTargetsByYear)  setQuarterlyTargetsByYear(s.quarterlyTargetsByYear)
      if (s.productTargetRowsByYear) setProductTargetRowsByYear(s.productTargetRowsByYear)
      if (s.probabilityDefaults)     setProbabilityDefaults({ ...DEFAULT_PROBABILITY, ...s.probabilityDefaults })
      if (s.managerColors)           setManagerColorOverrides(s.managerColors)
      if (s.managerTerritories)      setManagerTerritories(s.managerTerritories)
      if (s.notificationSettings)    setNotificationSettings(normalizeNotificationConfig(s.notificationSettings))
      setSettingsLoaded(true)
    })
  }, [])

  // ── Persist settings — localStorage + Supabase, debounced ─────────────────
  // Debounced so typing in a target/territory/probability field doesn't fire
  // a Supabase upsert on every keystroke; only the settled value is synced.
  useEffect(() => {
    if (!settingsLoaded) return
    const t = setTimeout(() => {
      saveSettings({
        managers,
        products,
        headOfSales,
        partners,
        targetsByYear,
        quarterlyTargetsByYear,
        productTargetRowsByYear,
        probabilityDefaults,
        managerColors: managerColorOverrides,
        managerTerritories,
        notificationSettings,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [settingsLoaded, managers, products, headOfSales, partners, targetsByYear, quarterlyTargetsByYear, productTargetRowsByYear, probabilityDefaults, managerColorOverrides, managerTerritories, notificationSettings])

  const overallTarget = useMemo(
    () => Object.values(managerTargets).reduce((s, v) => s + v, 0),
    [managerTargets],
  )

  // ── Quarterly targets for selected year ──────────────────────────────────
  // Only managers with a real annual target (backing product rows) contribute,
  // so stale quarterly numbers without product rows don't surface.
  const quarterlyForYear = useCallback((year: string): Record<string, QuarterlyData> => {
    const stored = quarterlyTargetsByYear[year] ?? {}
    const annual = targetsForYear(year)
    const out: Record<string, QuarterlyData> = {}
    for (const [m, q] of Object.entries(stored)) {
      if ((annual[m] ?? 0) > 0) out[m] = q
    }
    return out
  }, [quarterlyTargetsByYear, targetsForYear])

  const quarterlyTargets = useMemo(() => {
    if (selectedYear === ALL_YEARS) {
      const agg: Record<string, QuarterlyData> = {}
      for (const year of Object.keys(quarterlyTargetsByYear)) {
        for (const [m, q] of Object.entries(quarterlyForYear(year))) {
          const cur = agg[m] ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
          agg[m] = { q1: cur.q1 + q.q1, q2: cur.q2 + q.q2, q3: cur.q3 + q.q3, q4: cur.q4 + q.q4 }
        }
      }
      return agg
    }
    return quarterlyForYear(selectedYear)
  }, [quarterlyTargetsByYear, selectedYear, quarterlyForYear])
  const setQuarterlyTargets = useCallback(
    (v: Record<string, QuarterlyData>) =>
      setQuarterlyTargetsByYear((prev) => ({ ...prev, [selectedYear]: v })),
    [selectedYear],
  )

  const productTargetRowsByManager = useMemo(
    () => productTargetRowsByYear[selectedYear] ?? {},
    [productTargetRowsByYear, selectedYear],
  )
  const setProductTargetRowsByManager = useCallback(
    (v: Record<string, ProductTargetRow[]>) =>
      setProductTargetRowsByYear((prev) => ({ ...prev, [selectedYear]: v })),
    [selectedYear],
  )

  // ── All unique managers (HoS excluded — separate role) ────────────────────
  const allManagers = useMemo(() => {
    const managersLower = managers.map((n) => n.toLowerCase())
    const extra = Array.from(new Set(
      liveOpps
        .map((o) => (o.owner as string) ?? '')
        .filter((owner) => owner && !managersLower.includes(owner.toLowerCase()) && owner.toLowerCase() !== headOfSales.toLowerCase()),
    ))
    // Exclude HoS from the sales team list
    return [...managers.filter((m) => m.toLowerCase() !== headOfSales.toLowerCase()), ...extra]
  }, [managers, liveOpps, headOfSales])

  // ── Available years ───────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const yearsFromData = Array.from(new Set(
      liveOpps
        .map((o) => ((o as any).close_date ?? '').match(/\d{4}/)?.[0])
        .filter(Boolean) as string[],
    ))
    const years = Array.from(new Set([
      ...yearsFromData,
      CURRENT_YEAR,
      String(Number(CURRENT_YEAR) + 1),
      String(Number(CURRENT_YEAR) + 2),
    ])).sort()
    return [ALL_YEARS, ...years]
  }, [liveOpps])

  // ── Role-derived flags ────────────────────────────────────────────────────
  const isHoS        = viewAs === HEAD_OF_SALES || viewAs === headOfSales
  const isPartner    = partners.includes(viewAs)
  const isFullAccess = isHoS || isPartner

  const managerColors = useMemo(
    () => Object.fromEntries(
      managers.map((n, i) => [n, managerColorOverrides[n] ?? COLOR_PALETTE[i % COLOR_PALETTE.length]]),
    ),
    [managers, managerColorOverrides],
  )

  const handleManagerColorChange = useCallback((name: string, color: string) => {
    setManagerColorOverrides((prev) => ({ ...prev, [name]: color }))
  }, [])

  const handleManagerTerritoryChange = useCallback((name: string, territory: string) => {
    setManagerTerritories((prev) => ({ ...prev, [name]: territory }))
  }, [])

  const tabs = useMemo<Tab[]>(
    () => isAdmin && isHoS
      ? ['Dashboard', 'Sales Managers', 'Leads', 'Opportunities', 'Analytics', 'Projection', 'Targets', 'Settings']
      : isAdmin && !isHoS
      ? ['Dashboard', 'Leads', 'Opportunities', 'Analytics', 'Projection', 'Targets']
      : isHoS
      ? ['Dashboard', 'Sales Managers', 'Leads', 'Opportunities', 'Analytics', 'Projection', 'Targets', 'Settings']
      : isPartner
      ? ['Dashboard', 'Sales Managers', 'Leads', 'Opportunities', 'Analytics', 'Projection']
      : ['Dashboard', 'Leads', 'Opportunities', 'Analytics', 'Projection'],
    [isAdmin, isHoS, isPartner],
  )
  const safeTab: Tab = tabs.includes(activeTab) ? activeTab : 'Dashboard'

  // ── Filtered opportunity slices ───────────────────────────────────────────
  // Year filter applies to Analytics/Dashboard; Pipeline always shows all opps.
  const yearFilteredOpps = useMemo(
    () => liveOpps.filter((o) => {
      if (selectedYear === ALL_YEARS) return true
      const cd = (o as any).close_date ?? ''
      return !cd || cd.includes(selectedYear)
    }),
    [liveOpps, selectedYear],
  )

  const allVisibleOpps = useMemo(
    () => isFullAccess
      ? liveOpps
      : liveOpps.filter((o) => (o.owner as string)?.toLowerCase() === viewAs.toLowerCase()),
    [isFullAccess, liveOpps, viewAs],
  )

  const visibleOpps = useMemo(
    () => isFullAccess
      ? yearFilteredOpps
      : yearFilteredOpps.filter(
          (o) => (o.owner as string)?.toLowerCase() === viewAs.toLowerCase(),
        ),
    [isFullAccess, yearFilteredOpps, viewAs],
  )

  // Leads visible under the current persona (managers see their own only),
  // year-filtered by creation date for the Analytics funnel.
  const visibleLeads = useMemo(
    () => isFullAccess
      ? leads
      : leads.filter((l) => (l.owner ?? '').toLowerCase() === viewAs.toLowerCase()),
    [isFullAccess, leads, viewAs],
  )

  const analyticsLeads = useMemo(
    () => selectedYear === ALL_YEARS
      ? visibleLeads
      : visibleLeads.filter((l) => (l.created_at ?? '').startsWith(selectedYear)),
    [visibleLeads, selectedYear],
  )

  const activeLeadCount = useMemo(
    () => visibleLeads.filter((l) => !['Dropped', 'Converted'].includes(l.status ?? 'New')).length,
    [visibleLeads],
  )

  // ── Banner metrics ────────────────────────────────────────────────────────
  // Forecast excludes lost deals — a deal marked Loss must drop out of the
  // forecast immediately, otherwise the banner/charts never reflect the loss.
  const { totalForecast, closedOrders, openPipeline } = useMemo(() => ({
    totalForecast: visibleOpps
      .filter((o) => o.stage !== 'Loss')
      .reduce((s, o) => s + toUSD(o.value ?? 0, (o as any).currency), 0),
    closedOrders:  visibleOpps
      .filter((o) => o.stage === 'Win')
      .reduce((s, o) => s + toUSD((o as any).final_win_value || o.value || 0, (o as any).currency), 0),
    openPipeline:  visibleOpps
      .filter((o) => !['Win', 'Loss'].includes(o.stage))
      .reduce((s, o) => s + toUSD(o.value ?? 0, (o as any).currency), 0),
  }), [visibleOpps])
  const bannerTarget = isFullAccess ? overallTarget : (managerTargets[viewAs] ?? 0)

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNewOpportunity = useCallback(() => {
    if (safeTab !== 'Opportunities') setActiveTab('Opportunities')
    setAddFormOpen(true)
  }, [safeTab])

  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const handleNewLead = useCallback(() => {
    if (safeTab !== 'Leads') setActiveTab('Leads')
    setAddLeadOpen(true)
  }, [safeTab])

  // Bug fix: previously called setManagerTargets(fn) where setManagerTargets
  // only accepts Record<string,number>, so the function reference was stored as
  // the value. Now we call setTargetsByYear directly with a functional updater.
  const handleManagersChange = useCallback((newManagers: string[]) => {
    setManagers(newManagers)
    setTargetsByYear((prev) => ({
      ...prev,
      [selectedYear]: Object.fromEntries(
        newManagers.map((n) => [n, (prev[selectedYear] ?? {})[n] ?? 0]),
      ),
    }))
  }, [selectedYear])

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }
  if (passwordRecovery) return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
  if (!profile) return <LoginScreen />
  if (!profile.role) return <SetupScreen email={profile.email} />
  if (oppsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="text-sm text-slate-400">Loading opportunities…</p>
      </div>
    )
  }
  if (oppsError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-900 p-8">
        <p className="text-sm text-red-400">Failed to load opportunities: {oppsError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-100 font-sans">

      {/* ── Print-only title ────────────────────────────────────────────────── */}
      <div className="print-only hidden border-b-2 border-gray-200 pb-4 mb-5 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/OS-Logo.png" alt="Over-Sat Logo" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-bold text-gray-900">{safeTab}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isHoS ? `Full Access — ${headOfSales}` : `View — ${viewAs}`} &nbsp;·&nbsp; Year: {selectedYear}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-y-2 px-5 py-3">

          {/* Logo + title — no white container needed on white header */}
          <button
            onClick={() => { setActiveTab('Dashboard') }}
            title="Home"
            className="flex items-center gap-3 transition-opacity hover:opacity-75"
          >
            <div className="flex h-10 w-36 shrink-0 items-center overflow-hidden">
              <img src="/OS-Logo.png" alt="Over-Sat Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-bold text-gray-900">CRM</span>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-1.5">

            {/* Year selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              title="Select year"
              className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-semibold text-gray-700 focus:border-orange-400 focus:outline-none"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Persona selector — hidden for locked roles */}
            {!isLockedView && (
              <div className="relative" ref={viewerRef}>
                <button
                  onClick={() => setViewerOpen((v) => !v)}
                  title="Switch view"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 transition-colors hover:bg-gray-100"
                >
                  <span className="max-w-[120px] truncate text-sm font-semibold text-gray-700">
                    {viewAs === HEAD_OF_SALES ? headOfSales : viewAs}
                  </span>
                  <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${viewerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {viewerOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                    <div className="px-3 pb-1 pt-3">
                      <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">Full Access</p>
                      <button
                        onClick={() => { setViewAs(HEAD_OF_SALES); setActiveTab('Dashboard'); setViewerOpen(false) }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${viewAs === HEAD_OF_SALES ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {headOfSales}
                      </button>
                    </div>
                    <div className="px-3 py-1">
                      <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">Sales Managers</p>
                      {allManagers.map((n) => (
                        <button
                          key={n}
                          onClick={() => { setViewAs(n); setActiveTab('Dashboard'); setViewerOpen(false) }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${viewAs === n ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {partners.length > 0 && (
                      <div className="px-3 pb-3 pt-1">
                        <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">Partners</p>
                        {partners.map((n) => (
                          <button
                            key={n}
                            onClick={() => { setViewAs(n); setActiveTab('Dashboard'); setViewerOpen(false) }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${viewAs === n ? 'bg-emerald-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* New Lead — green CTA */}
            <button
              onClick={handleNewLead}
              title="New Lead"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Lead
            </button>

            {/* New Opportunity — orange CTA */}
            <button
              onClick={handleNewOpportunity}
              title="New Opportunity"
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Opportunity
            </button>

            {/* Print — icon only */}
            <button
              onClick={() => window.print()}
              title="Print"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>

            {/* Export CSV — icon only */}
            <button
              onClick={() => exportCSV(visibleOpps)}
              title="Export CSV"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Sign out — icon only, email shown as tooltip */}
            <button
              onClick={handleLogout}
              title={`Sign out — ${profile.email}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>

          </div>
        </div>
      </header>

      {/* ── Pill Navigation ─────────────────────────────────────────────────── */}
      <div className="no-print sticky top-[68px] z-30 border-b border-gray-200 bg-white shadow-sm">
        {/* overflow-x-auto keeps all tabs reachable on phone-width screens */}
        <div className="mx-auto flex max-w-screen-xl items-center gap-4 overflow-x-auto px-6 py-3">
          <div className="inline-flex shrink-0 gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  safeTab === tab
                    ? TAB_STYLE[tab].active
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {safeTab !== tab && <span className={`h-1.5 w-1.5 rounded-full ${TAB_STYLE[tab].dot}`} />}
                {tab}
              </button>
            ))}
          </div>
          <span className="hidden whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm sm:inline-block">
            {isHoS ? `👁 Full Access — ${headOfSales}` : isPartner ? `🤝 Partner View — ${viewAs}` : `🔒 Manager View — ${viewAs}`}
          </span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">

        {/* Performance Banner */}
        {(safeTab === 'Dashboard' || safeTab === 'Sales Managers') && (
          <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-slate-800 to-indigo-900 px-6 py-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {isHoS ? `${headOfSales} — All Teams` : isPartner ? 'Partner View — All Teams' : 'Manager View'}
                </p>
                <h2 className="text-2xl font-bold text-white">
                  {isHoS ? headOfSales : viewAs}
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {isFullAccess ? 'Full opportunity visibility' : 'Personal opportunities'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Overall Target',  value: fmtCurrency(bannerTarget),  accent: 'border-blue-500'   },
                  { label: 'Total Forecast',  value: fmtCurrency(totalForecast), accent: 'border-indigo-400' },
                  { label: 'Win',             value: fmtCurrency(closedOrders),  accent: 'border-emerald-400'},
                  { label: 'Open Pipeline',   value: fmtCurrency(openPipeline),  accent: 'border-orange-400' },
                  { label: 'Opportunities',   value: String(visibleOpps.length), accent: 'border-slate-500'  },
                  ...(leadsError ? [] : [{ label: 'Active Leads', value: String(activeLeadCount), accent: 'border-cyan-400' }]),
                ].map(({ label, value, accent }) => (
                  <div key={label} className={`min-w-[110px] rounded-xl border-t-2 bg-white/10 px-4 py-3 text-center backdrop-blur-sm ${accent}`}>
                    <p className="mb-1 text-xs text-slate-300">{label}</p>
                    <p className="text-base font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        {safeTab === 'Dashboard' && (
          <DashboardAnalytics
            opportunities={visibleOpps}
            viewAs={isFullAccess ? HEAD_OF_SALES : viewAs}
            overallTarget={overallTarget}
            managerTargets={managerTargets}
            managers={managers}
            managerColors={managerColors}
            leads={leadsError ? [] : visibleLeads}
          />
        )}

        {safeTab === 'Sales Managers' && isFullAccess && (
          <ManagersTab
            opportunities={liveOpps}
            leads={leadsError ? [] : leads}
            managerTargets={managerTargets}
            managers={managers}
            managerColors={managerColors}
            uploaderName={profile?.name ?? ''}
          />
        )}

        {safeTab === 'Leads' && (
          <LeadsTab
            leads={visibleLeads}
            loading={leadsLoading}
            error={leadsError}
            onReload={reloadLeads}
            managers={managers}
            currentUserName={profile?.name ?? ''}
            lockedOwner={profile?.role === 'manager' ? profile.name : undefined}
            readOnly={profile?.role === 'partner'}
            onOppAdded={handleOppAdded}
            addFormOpen={addLeadOpen}
            onAddFormOpenChange={setAddLeadOpen}
            managerColors={managerColors}
          />
        )}

        {safeTab === 'Opportunities' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {isFullAccess ? 'All Opportunities' : `${viewAs}'s Opportunities`}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {allVisibleOpps.length} opportunit{allVisibleOpps.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            <PipelineTab
              opportunities={allVisibleOpps}
              addFormOpen={addFormOpen}
              onAddFormOpenChange={setAddFormOpen}
              products={products}
              managers={isFullAccess ? managers : undefined}
              managerColors={managerColors}
              defaultOwner={managers.find((m) => m.toLowerCase() === (profile?.name ?? '').toLowerCase()) ?? managers.find((m) => (profile?.name ?? '').toLowerCase().endsWith(m.toLowerCase())) ?? profile?.name ?? ''}
              canDelete={isAdmin || isHoS}
              probabilityDefaults={probabilityDefaults}
              onOppUpdated={handleOppUpdated}
              onOppAdded={handleOppAdded}
              onOppDeleted={handleOppDeleted}
            />
          </div>
        )}

        {safeTab === 'Targets' && (isHoS || isAdmin) && (
          selectedYear === ALL_YEARS ? (
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm">
              Targets are set per year. Select a specific year from the header to view or edit targets.
            </div>
          ) : (
          <TargetsTab
            managers={
              isAdmin && !isHoS
                ? managers.filter((m) => m.toLowerCase() === viewAs.toLowerCase())
                : managers.filter((m) => m.toLowerCase() !== headOfSales.toLowerCase())
            }
            managerTargets={managerTargets}
            onManagerTargetsChange={setManagerTargets}
            quarterlyTargets={quarterlyTargets}
            onQuarterlyTargetsChange={setQuarterlyTargets}
            selectedYear={selectedYear}
            availableYears={availableYears.filter((y) => y !== ALL_YEARS)}
            onCopyTargetsToYear={(toYear) => {
              // Targets derive from product rows, so copy the rows (fresh ids)
              // and the quarterly splits to the destination year.
              setProductTargetRowsByYear((prev) => {
                const src = prev[selectedYear] ?? {}
                const copy: Record<string, ProductTargetRow[]> = {}
                for (const [m, rows] of Object.entries(src)) copy[m] = rows.map((r) => ({ ...r, id: Math.random().toString(36).slice(2) }))
                return { ...prev, [toYear]: copy }
              })
              setQuarterlyTargetsByYear((prev) => ({ ...prev, [toYear]: { ...(prev[selectedYear] ?? {}) } }))
            }}
            products={products}
            productTargetRowsByManager={productTargetRowsByManager}
            onProductTargetRowsByManagerChange={setProductTargetRowsByManager}
            readOnly={isAdmin && !isHoS}
          />
          )
        )}

        {safeTab === 'Settings' && (isHoS || isAdmin) && (
          <div className="space-y-10">
            <SettingsTab
              managers={managers}
              products={products}
              headOfSales={headOfSales}
              partners={partners}
              managerColors={managerColors}
              managerTerritories={managerTerritories}
              probabilityDefaults={probabilityDefaults}
              onManagersChange={handleManagersChange}
              onProductsChange={setProducts}
              onHeadOfSalesChange={setHeadOfSales}
              onPartnersChange={setPartners}
              onManagerColorChange={handleManagerColorChange}
              onManagerTerritoryChange={handleManagerTerritoryChange}
              onProbabilityDefaultsChange={setProbabilityDefaults}
              notificationSettings={notificationSettings}
              onNotificationSettingsChange={setNotificationSettings}
            />
            {/* ── User & Password Management ───────────────────────────── */}
            <div>
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">User Management</h2>
                <p className="mt-0.5 text-sm text-gray-400">
                  Create and manage CRM user accounts, roles, and passwords.
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Admin only</span>
                </p>
              </div>
              <UsersTab currentUserId={profile?.id ?? ''} />
            </div>
          </div>
        )}

        {safeTab === 'Projection' && (
          /* Cross-year by design: the 8-quarter horizon spans multiple years,
             so the header's year selector intentionally doesn't apply here. */
          <ProjectionTab
            opportunities={allVisibleOpps}
            probabilityDefaults={probabilityDefaults}
          />
        )}

        {safeTab === 'Analytics' && (
          <AnalyticsTab
            opportunities={visibleOpps}
            managers={isAdmin && !isHoS ? [viewAs] : allManagers}
            managerTargets={isAdmin && !isHoS ? { [viewAs]: managerTargets[viewAs] ?? 0 } : managerTargets}
            quarterlyTargets={quarterlyTargets}
            leads={leadsError ? [] : analyticsLeads}
            managerColors={managerColors}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={setSelectedYear}
            probabilityDefaults={probabilityDefaults}
          />
        )}

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      {/* suppressHydrationWarning: new Date() is evaluated on both server and
          client; the date string is identical in practice but React flags the
          attribute as a potential mismatch. Suppressing on the wrapping span is
          the idiomatic fix — it doesn't suppress anything else in the tree. */}
      <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-xs text-gray-400">
        Over-Sat CRM &nbsp;·&nbsp; Version 1.0 &nbsp;·&nbsp;{' '}
        <span suppressHydrationWarning>
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </span>
      </footer>

    </div>
    </ErrorBoundary>
  )
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(opportunities: Opportunity[]) {
  const headers = ['Name','Account','Owner','Stage','Status','Product','Country','Close Date','Currency','Value','Value (USD)','Probability %','Win Value','Loss Reason','Loss Description','Last Updated']
  const rows    = opportunities.map((o) => [
    o.name ?? '', o.customer_name ?? '', (o.owner as string) ?? '',
    o.stage ?? '', (o.status as string) ?? '', (o.product as string) ?? '',
    (o.country as string) ?? '', (o as any).close_date ?? '',
    (o as any).currency ?? 'USD', o.value ?? '',
    o.value != null ? Math.round(toUSD(o.value, (o as any).currency)) : '',
    (o as any).probability ?? '',
    (o as any).final_win_value ?? '',
    o.loss_reason ?? '', o.loss_description ?? '',
    (o as any).updated_at ?? (o as any).created_at ?? '',
  ])
  const csv  = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

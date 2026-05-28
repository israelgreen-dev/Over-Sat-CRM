'use client'

import { useState, useRef, useEffect } from 'react'
import { type Opportunity } from './OpportunitiesTable'
import DashboardAnalytics, { GLOBAL_TARGET, MANAGER_TARGETS } from './DashboardAnalytics'
import ManagersTab from './ManagersTab'
import PipelineTab from './PipelineTab'
import SettingsTab from './SettingsTab'

// ── Constants ─────────────────────────────────────────────────────────────────
const HEAD_OF_SALES    = 'head_of_sales'
const MANAGER_NAMES    = Object.keys(MANAGER_TARGETS)
const DEFAULT_PRODUCTS = ['Python5', 'Python7', 'Mantis10', 'Rigel', 'Griffin', 'Scorpion', 'Cameleon']
const COLOR_PALETTE    = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']

type Tab = 'Dashboard' | 'Sales Managers' | 'Pipeline' | 'Settings'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard({ opportunities }: { opportunities: Opportunity[] }) {
  const [viewAs, setViewAs]           = useState<string>(HEAD_OF_SALES)
  const [activeTab, setActiveTab]     = useState<Tab>('Dashboard')
  const [addFormOpen, setAddFormOpen] = useState(false)

  // ── Live opportunities state (kept in sync with edits/adds from Pipeline) ──
  const [liveOpps, setLiveOpps] = useState<Opportunity[]>(opportunities)

  function handleOppUpdated(updated: Opportunity) {
    setLiveOpps((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  function handleOppAdded(newOpp: Opportunity) {
    setLiveOpps((prev) => [newOpp, ...prev])
  }
  const [logoUrl, setLogoUrl]         = useState<string | null>(null)
  const logoInputRef                  = useRef<HTMLInputElement>(null)

  // Load persisted logo on mount
  useEffect(() => {
    const saved = localStorage.getItem('oversat_crm_logo')
    if (saved) setLogoUrl(saved)
  }, [])

  // ── Editable lists (Settings) ─────────────────────────────────────────────
  const [managers, setManagers]     = useState<string[]>([...MANAGER_NAMES])
  const [products, setProducts]     = useState<string[]>(DEFAULT_PRODUCTS)
  const [headOfSales, setHeadOfSales] = useState<string>(MANAGER_NAMES[0] ?? '')

  // ── Editable targets ─────────────────────────────────────────────────────
  const [overallTarget, setOverallTarget]   = useState<number>(GLOBAL_TARGET)
  const [managerTargets, setManagerTargets] = useState<Record<string, number>>({ ...MANAGER_TARGETS })

  // ── Derived ───────────────────────────────────────────────────────────────
  const isHoS = viewAs === HEAD_OF_SALES || viewAs === headOfSales

  const managerColors = Object.fromEntries(
    managers.map((n, i) => [n, COLOR_PALETTE[i % COLOR_PALETTE.length]]),
  )

  const tabs: Tab[] = isHoS
    ? ['Dashboard', 'Sales Managers', 'Pipeline', 'Settings']
    : ['Dashboard', 'Pipeline']
  const safeTab: Tab = tabs.includes(activeTab) ? activeTab : 'Dashboard'

  const visibleOpps = isHoS
    ? liveOpps
    : liveOpps.filter(
        (o) => (o.owner as string)?.toLowerCase() === viewAs.toLowerCase(),
      )

  // ── Banner metrics ────────────────────────────────────────────────────────
  const totalForecast = visibleOpps.reduce((s, o) => s + (o.value ?? 0), 0)
  const closedOrders  = visibleOpps.filter((o) => o.stage === 'Win').reduce((s, o) => s + ((o as any).final_win_value ?? 0), 0)
  const openPipeline  = visibleOpps.filter((o) => !['Win', 'Loss'].includes(o.stage)).reduce((s, o) => s + (o.value ?? 0), 0)
  const bannerTarget  = isHoS ? overallTarget : (managerTargets[viewAs] ?? 0)

  function handleNewOpportunity() {
    if (safeTab !== 'Pipeline') setActiveTab('Pipeline')
    setAddFormOpen(true)
  }

  function handleManagersChange(newManagers: string[]) {
    setManagers(newManagers)
    // Sync target draft — keep existing values, add zero for new managers
    setTargetDraft((d) => ({
      ...d,
      managers: Object.fromEntries(
        newManagers.map((n) => [n, d.managers[n] ?? '0']),
      ),
    }))
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setLogoUrl(dataUrl)
      localStorage.setItem('oversat_crm_logo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-800 shadow-md">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-6 py-4">

          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => logoInputRef.current?.click()}
              title="Click to upload a logo"
              className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white transition-opacity hover:opacity-80"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-slate-700" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
                  <path d="M3.5 3.5a14 14 0 0 0 0 17M20.5 3.5a14 14 0 0 1 0 17" />
                </svg>
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs text-white group-hover:flex">
                Upload
              </span>
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-white">
                Over-Sat CRM
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Over-Sat Proprietary &amp; Confidential
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Persona selector */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-3 py-1.5">
              <span className="text-xs text-slate-400">Viewing as</span>
              <select
                value={viewAs}
                onChange={(e) => { setViewAs(e.target.value); setActiveTab('Dashboard') }}
                className="cursor-pointer bg-transparent text-sm font-semibold text-white focus:outline-none"
              >
                <option value={HEAD_OF_SALES}>Head of Sales</option>
                {managers.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <button
              onClick={handleNewOpportunity}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              + New Opportunity
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Print
            </button>
            <button
              onClick={() => exportCSV(visibleOpps)}
              className="rounded-xl border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* ── Pill Navigation ─────────────────────────────────────────────────── */}
      <div className="sticky top-[72px] z-30 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-screen-xl items-center gap-4 px-6 py-3">
          <div className="inline-flex gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition-all duration-150 ${
                  safeTab === tab
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
            {isHoS ? '👁 Full Access — Head of Sales' : `🔒 Manager View — ${viewAs}`}
          </span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">

        {/* Performance Banner */}
        {(safeTab === 'Dashboard' || safeTab === 'Sales Managers') && (
          <div className="rounded-2xl bg-slate-800 px-6 py-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {isHoS ? 'Head of Sales — All Teams' : 'Manager View'}
                </p>
                <h2 className="text-2xl font-bold text-white">
                  {isHoS ? headOfSales : viewAs}
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {isHoS ? 'Full pipeline visibility' : 'Personal pipeline'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Overall Target',  value: fmtCurrency(bannerTarget)  },
                  { label: 'Total Forecast',  value: fmtCurrency(totalForecast) },
                  { label: 'Win',             value: fmtCurrency(closedOrders)  },
                  { label: 'Open Pipeline',   value: fmtCurrency(openPipeline)  },
                  { label: 'Opportunities',   value: String(visibleOpps.length) },
                ].map(({ label, value }) => (
                  <div key={label} className="min-w-[110px] rounded-xl bg-slate-700 px-4 py-3 text-center">
                    <p className="mb-1 text-xs text-slate-400">{label}</p>
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
            viewAs={viewAs}
            overallTarget={overallTarget}
            managerTargets={managerTargets}
            managers={managers}
            managerColors={managerColors}
          />
        )}

        {safeTab === 'Sales Managers' && isHoS && (
          <ManagersTab
            opportunities={liveOpps}
            managerTargets={managerTargets}
            managers={managers}
            managerColors={managerColors}
          />
        )}

        {safeTab === 'Pipeline' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">
                {isHoS ? 'Full Pipeline' : `${viewAs}'s Pipeline`}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {visibleOpps.length} opportunit{visibleOpps.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            <PipelineTab
              opportunities={visibleOpps}
              addFormOpen={addFormOpen}
              onAddFormOpenChange={setAddFormOpen}
              products={products}
              managers={isHoS ? managers : undefined}
              defaultOwner={isHoS ? '' : viewAs}
              onOppUpdated={handleOppUpdated}
              onOppAdded={handleOppAdded}
            />
          </div>
        )}

        {safeTab === 'Settings' && isHoS && (
          <SettingsTab
            managers={managers}
            products={products}
            headOfSales={headOfSales}
            onManagersChange={handleManagersChange}
            onProductsChange={setProducts}
            onHeadOfSalesChange={setHeadOfSales}
            overallTarget={overallTarget}
            managerTargets={managerTargets}
            onOverallTargetChange={setOverallTarget}
            onManagerTargetsChange={setManagerTargets}
          />
        )}
      </main>

    </div>
  )
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(opportunities: Opportunity[]) {
  const headers = ['Name','Account','Owner','Stage','Status','Product','Country','Value','Loss Reason','Loss Description']
  const rows    = opportunities.map((o) => [
    o.name ?? '', o.customer_name ?? '', (o.owner as string) ?? '',
    o.stage ?? '', (o.status as string) ?? '', (o.product as string) ?? '',
    (o.country as string) ?? '', o.value ?? '',
    o.loss_reason ?? '', o.loss_description ?? '',
  ])
  const csv  = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

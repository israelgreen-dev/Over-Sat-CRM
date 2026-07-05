'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { type Opportunity, effectiveProbability, getProductLines, lineTotal } from './OpportunitiesTable'
import { type Lead } from './LeadsTab'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function winVal(o: Opportunity) { return (o as any).final_win_value || o.value || 0 }
// close_date is stored as a quarter string ("Q1-2026"), not a calendar date.
// Parse the quarter label from it, falling back to a real date if one is given.
function quarterLabel(cd: string | null | undefined): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null {
  if (!cd) return null
  const m = String(cd).match(/Q([1-4])/i)
  if (m) return `Q${m[1]}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
  const d = new Date(cd)
  if (!Number.isNaN(d.getTime())) return `Q${Math.floor(d.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
  return null
}
function pipeVal(o: Opportunity) { return o.value ?? 0 }
function pct(num: number, den: number) { return den > 0 ? Math.round((num / den) * 100) : 0 }

const STAGE_COLORS: Record<string, string> = {
  Discovery: '#3b82f6', Proposal: '#f59e0b', Negotiation: '#f97316', Win: '#10b981', Loss: '#ef4444',
}
const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']
const STATUS_COLORS: Record<string, string> = { 'On Track': '#10b981', 'Risk': '#f59e0b', 'Critical': '#ef4444', 'No Status': '#94a3b8' }

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function KPI({ label, value, sub, color = 'text-slate-900', bg = 'bg-gray-50' }: { label: string; value: string; sub?: string; color?: string; bg?: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 ${bg} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-sm text-gray-400">No data for this period.</p>
}

const QUARTERS: { label: string; months: number[] }[] = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
]

export default function AnalyticsTab({
  opportunities,
  managers,
  managerTargets,
  quarterlyTargets = {},
  leads = [],
  managerColors,
  selectedYear,
  availableYears = [],
  onYearChange,
  probabilityDefaults,
}: {
  opportunities: Opportunity[]
  managers: string[]
  managerTargets: Record<string, number>
  quarterlyTargets?: Record<string, { q1: number; q2: number; q3: number; q4: number }>
  leads?: Lead[]
  managerColors: Record<string, string>
  selectedYear: string
  availableYears?: string[]
  onYearChange?: (year: string) => void
  probabilityDefaults?: Record<string, number>
}) {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('')

  const opps = useMemo(() => {
    if (!selectedQuarter) return opportunities
    if (selectedQuarter === 'No Date') {
      return opportunities.filter((o) => !(o as any).close_date)
    }
    return opportunities.filter((o) => quarterLabel((o as any).close_date) === selectedQuarter)
  }, [opportunities, selectedQuarter])
  const wins   = opps.filter((o) => o.stage === 'Win')
  const losses = opps.filter((o) => o.stage === 'Loss')
  const active = opps.filter((o) => !['Win', 'Loss'].includes(o.stage))

  const totalPipeline  = active.reduce((s, o) => s + pipeVal(o), 0)
  const totalWin       = wins.reduce((s, o) => s + winVal(o), 0)
  // Forecast excludes lost deals so marking a deal as Loss is reflected here.
  const totalForecast  = opps.filter((o) => o.stage !== 'Loss').reduce((s, o) => s + pipeVal(o), 0)
  const totalLostValue = losses.reduce((s, o) => s + pipeVal(o), 0)
  const overallTarget  = Object.values(managerTargets).reduce((s, v) => s + v, 0)
  const achievementPct = pct(totalWin, overallTarget)
  const winRateCount   = pct(wins.length, opps.length)
  const winRateValue   = pct(totalWin, totalForecast)
  const avgWin         = wins.length > 0 ? totalWin / wins.length : 0
  const avgLoss        = losses.length > 0 ? totalLostValue / losses.length : 0

  // Stage data
  const STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']
  const stageData = STAGES.map((stage) => {
    const s = opps.filter((o) => o.stage === stage)
    const val = stage === 'Win' ? s.reduce((a, o) => a + winVal(o), 0) : s.reduce((a, o) => a + pipeVal(o), 0)
    return { stage, count: s.length, value: val }
  })
  const maxStageVal = Math.max(...stageData.map((d) => d.value), 1)

  // Weighted pipeline
  const weightedPipeline = active.reduce((s, o) => s + (pipeVal(o) * effectiveProbability(o, probabilityDefaults)) / 100, 0)

  // Funnel (by value)
  const funnelStages = ['Discovery', 'Proposal', 'Negotiation', 'Win']
  const funnelData = funnelStages.map((stage) => {
    const s    = opps.filter((o) => o.stage === stage)
    const val  = stage === 'Win' ? s.reduce((a, o) => a + winVal(o), 0) : s.reduce((a, o) => a + pipeVal(o), 0)
    return { stage, count: s.length, value: val, fill: STAGE_COLORS[stage] }
  })

  // Loss reasons
  const lossMap: Record<string, number> = {}
  losses.forEach((o) => { const r = o.loss_reason ?? 'Unknown'; lossMap[r] = (lossMap[r] ?? 0) + 1 })
  const lossData = Object.entries(lossMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

  // Product
  // A deal can include several products; each product line is credited its own
  // value. Win values scale to the actual won amount so product totals add up.
  const prodMap: Record<string, { count: number; value: number; winCount: number; winValue: number }> = {}
  opps.forEach((o) => {
    const lines = getProductLines(o)
    const list = lines.length > 0 ? lines : [{ id: '', product: 'Unspecified', price: pipeVal(o), quantity: 1 }]
    const deal = pipeVal(o)
    const winScale = o.stage === 'Win' && deal > 0 ? winVal(o) / deal : 0
    for (const l of list) {
      const p = l.product || 'Unspecified'
      const lv = lineTotal(l)
      if (!prodMap[p]) prodMap[p] = { count: 0, value: 0, winCount: 0, winValue: 0 }
      prodMap[p].count++; prodMap[p].value += lv
      if (o.stage === 'Win') { prodMap[p].winCount++; prodMap[p].winValue += lv * winScale }
    }
  })
  const prodData = Object.entries(prodMap).map(([product, d]) => ({ product, ...d, winRate: pct(d.winCount, d.count) })).sort((a, b) => b.value - a.value)

  // Country
  const cntryMap: Record<string, { count: number; value: number; wins: number }> = {}
  opps.forEach((o) => {
    const c = (o as any).country || 'Unknown'
    if (!cntryMap[c]) cntryMap[c] = { count: 0, value: 0, wins: 0 }
    cntryMap[c].count++; cntryMap[c].value += pipeVal(o)
    if (o.stage === 'Win') cntryMap[c].wins++
  })
  const cntryData = Object.entries(cntryMap).map(([country, d]) => ({ country, ...d })).sort((a, b) => b.value - a.value).slice(0, 10)

  // Quarterly
  const qtrMap: Record<string, { pipeline: number; win: number; count: number }> = {}
  opps.forEach((o) => {
    const q = (o as any).close_date || 'No Date'
    if (!qtrMap[q]) qtrMap[q] = { pipeline: 0, win: 0, count: 0 }
    qtrMap[q].count++
    if (o.stage !== 'Loss') qtrMap[q].pipeline += pipeVal(o) // lost deals leave the pipeline
    if (o.stage === 'Win') qtrMap[q].win += winVal(o)
  })
  const qtrData = Object.entries(qtrMap).map(([quarter, d]) => ({ quarter, ...d })).sort((a, b) => a.quarter.localeCompare(b.quarter))

  // Status
  const statusMap: Record<string, number> = {}
  active.forEach((o) => { const s = (o as any).status || 'No Status'; statusMap[s] = (statusMap[s] ?? 0) + 1 })
  const statusData = Object.entries(statusMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

  // Manager performance — only managers defined in Settings.
  const mgrData = managers.map((name, i) => {
    const m = opps.filter((o) => (o.owner as string)?.toLowerCase() === name.toLowerCase())
    const w = m.filter((o) => o.stage === 'Win')
    const a = m.filter((o) => !['Win', 'Loss'].includes(o.stage))
    const winAmt   = w.reduce((s, o) => s + winVal(o), 0)
    const pipeline = a.reduce((s, o) => s + pipeVal(o), 0)
    const target   = managerTargets[name] ?? 0
    const gap      = target - winAmt
    const rate     = pct(w.length, m.length)
    const color    = managerColors[name] ?? PALETTE[i % PALETTE.length]
    return { name, winAmt, pipeline, target, gap, winCount: w.length, lossCount: m.filter((o) => o.stage === 'Loss').length, total: m.length, rate, color }
  }).sort((a, b) => b.winAmt - a.winAmt)

  const barData = mgrData.map((m) => ({ name: m.name, Target: m.target, Win: m.winAmt, Pipeline: m.pipeline }))

  // ── Planned vs Actual ──────────────────────────────────────────────────────
  // Planned = target/quota, Actual = won value. Two views: per manager and per
  // quarter (with a "No Date" bucket for wins that have no close date).
  const planVsActualByManager = mgrData.map((m) => ({ name: m.name, Planned: m.target, Actual: m.winAmt }))

  const qPlanned = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  Object.values(quarterlyTargets).forEach((q) => {
    qPlanned.Q1 += q.q1; qPlanned.Q2 += q.q2; qPlanned.Q3 += q.q3; qPlanned.Q4 += q.q4
  })
  const qActual: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, 'No Date': 0 }
  wins.forEach((o) => {
    const ql = quarterLabel((o as any).close_date)
    qActual[ql ?? 'No Date'] += winVal(o)
  })
  const planVsActualByQuarter = ['Q1', 'Q2', 'Q3', 'Q4', 'No Date'].map((label) => ({
    quarter: label,
    Planned: (qPlanned as Record<string, number>)[label] ?? 0,
    Actual: qActual[label],
  }))
  // Line/trend view: Q1–Q4 only (a "No Date" point would drag Planned to 0).
  const planVsActualTrend = planVsActualByQuarter.filter((d) => d.quarter !== 'No Date')
  const hasPlanVsActual = planVsActualByManager.some((m) => m.Planned > 0 || m.Actual > 0)

  // ── Lead funnel ────────────────────────────────────────────────────────────
  const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Converted', 'Dropped'] as const
  const LEAD_STAGE_COLORS: Record<string, string> = {
    New: '#3b82f6', Contacted: '#f59e0b', Qualified: '#10b981', Converted: '#059669', Dropped: '#94a3b8',
  }
  const leadStageCounts = LEAD_STAGES.map((s) => ({
    status: s,
    count: leads.filter((l) => (l.status ?? 'New') === s).length,
    fill: LEAD_STAGE_COLORS[s],
  }))
  const convertedLeads  = leadStageCounts.find((s) => s.status === 'Converted')?.count ?? 0
  const decidedLeads    = convertedLeads + (leadStageCounts.find((s) => s.status === 'Dropped')?.count ?? 0)
  const leadConversion  = decidedLeads > 0 ? Math.round((convertedLeads / decidedLeads) * 100) : 0
  const activeLeads     = leads.length - decidedLeads
  const maxLeadCount    = Math.max(...leadStageCounts.map((s) => s.count), 1)

  const leadMgrRows = managers.map((name) => {
    const own = leads.filter((l) => (l.owner ?? '').toLowerCase() === name.toLowerCase())
    const conv = own.filter((l) => (l.status ?? '') === 'Converted').length
    const dropped = own.filter((l) => (l.status ?? '') === 'Dropped').length
    const decided = conv + dropped
    return {
      name,
      total: own.length,
      active: own.length - decided,
      qualified: own.filter((l) => (l.status ?? '') === 'Qualified').length,
      converted: conv,
      rate: decided > 0 ? Math.round((conv / decided) * 100) : 0,
    }
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">

      {/* ── Year + Quarter quick filters ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Year */}
        {availableYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Year:</span>
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => { onYearChange?.(y); setSelectedQuarter('') }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedYear === y
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {/* Quarter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quarter:</span>
          <button
            onClick={() => setSelectedQuarter('')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedQuarter === ''
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {QUARTERS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setSelectedQuarter(selectedQuarter === label ? '' : label)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedQuarter === label
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setSelectedQuarter(selectedQuarter === 'No Date' ? '' : 'No Date')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedQuarter === 'No Date'
                ? 'bg-slate-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            No Date
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-900">Analytics — {selectedYear}</h2>
        <p className="mt-0.5 text-sm text-gray-400">Full pipeline and performance intelligence for {selectedYear}.</p>
      </div>

      {/* ── Executive Summary ─────────────────────────────────────────────── */}
      <Section title="Executive Summary" subtitle={`${opps.length} opportunities in ${selectedYear}`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KPI label="Overall Target"    value={fmtShort(overallTarget)}    sub="annual team quota" />
          <KPI label="Total Win"         value={fmtShort(totalWin)}          sub={`${wins.length} deals`}   color="text-green-600" bg="bg-green-50" />
          <KPI label="Achievement"       value={`${achievementPct}%`}        sub="Win vs Target"    color={achievementPct >= 100 ? 'text-green-600' : achievementPct >= 70 ? 'text-amber-500' : 'text-red-500'} />
          <KPI label="Open Pipeline"     value={fmtShort(totalPipeline)}     sub={`${active.length} active`} color="text-blue-600" bg="bg-blue-50" />
          <KPI label="Weighted Pipeline" value={fmtShort(weightedPipeline)}  sub="prob-adjusted"    color="text-indigo-600" bg="bg-indigo-50" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Avg. Deal Size"   value={fmtShort(active.length > 0 ? totalPipeline / active.length : 0)} sub="per active deal" />
          <KPI label="Win Rate (count)" value={`${winRateCount}%`}        sub={`${wins.length} of ${opps.length}`} />
          <KPI label="Win Rate (value)" value={`${winRateValue}%`}        sub="won vs total pipeline" />
          <KPI label="Avg. Win Value"   value={fmtShort(avgWin)}          sub="per won deal" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Total Lost"       value={fmtShort(totalLostValue)} sub={`${losses.length} deals`}  color="text-red-500" />
          <KPI label="Avg. Loss Value"  value={fmtShort(avgLoss)}         sub="per lost deal"            color="text-red-500" />
          <KPI label="Total Forecast"   value={fmtShort(totalForecast)}   sub="open + won, excl. lost" />
          <KPI label="Opportunities"    value={String(opps.length)}        sub={`${active.length} active · ${wins.length} won · ${losses.length} lost`} />
        </div>
      </Section>

      {/* ── Lead funnel ───────────────────────────────────────────────────── */}
      {leads.length > 0 && (
        <Section title="Lead Funnel" subtitle="Top of the pipeline — leads by status and conversion into opportunities">
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI label="Total Leads"     value={String(leads.length)}    sub={selectedYear === 'All Years' ? 'all years' : `created in ${selectedYear}`} />
            <KPI label="Active Leads"    value={String(activeLeads)}     sub="new · contacted · qualified" color="text-blue-600" bg="bg-blue-50" />
            <KPI label="Converted"       value={String(convertedLeads)}  sub="became opportunities" color="text-emerald-600" bg="bg-emerald-50" />
            <KPI label="Conversion Rate" value={`${leadConversion}%`}    sub="of decided leads (converted vs dropped)" color={leadConversion >= 50 ? 'text-emerald-600' : 'text-amber-500'} />
          </div>

          {/* Status bars */}
          <div className="space-y-3">
            {leadStageCounts.map(({ status, count, fill }) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-right"><span className="text-xs font-semibold text-gray-700">{status}</span></div>
                <div className="flex-1">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxLeadCount) * 100}%`, backgroundColor: fill }} />
                  </div>
                </div>
                <div className="w-10 shrink-0 text-right text-sm font-bold text-gray-900">{count}</div>
              </div>
            ))}
          </div>

          {/* Per-manager breakdown */}
          {leadMgrRows.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 grid grid-cols-6 gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <div className="col-span-2">Manager</div>
                <div className="text-right">Leads</div>
                <div className="text-right">Active</div>
                <div className="text-right">Converted</div>
                <div className="text-right">Conv. Rate</div>
              </div>
              <div className="space-y-2">
                {leadMgrRows.map((r) => (
                  <div key={r.name} className="grid grid-cols-6 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                    <div className="col-span-2 text-sm font-semibold text-gray-900">{r.name}</div>
                    <div className="text-right text-sm text-gray-700">{r.total}</div>
                    <div className="text-right text-sm text-blue-600">{r.active}</div>
                    <div className="text-right text-sm font-semibold text-emerald-600">{r.converted}</div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.rate >= 50 ? 'bg-green-100 text-green-700' : r.rate > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{r.rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Achievement per manager ───────────────────────────────────────── */}
      <Section title="Annual Target Achievement" subtitle="Win progress vs quota per manager">
        {mgrData.length === 0 ? <Empty /> : (
          <div className="space-y-4">
            {mgrData.filter((m) => m.target > 0 || m.winAmt > 0).map((m) => (
              <div key={m.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-900">{m.name}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-600 font-semibold">{fmtShort(m.winAmt)} won</span>
                    <span className="text-gray-400">of {fmtShort(m.target)} target</span>
                    <span className="font-bold" style={{ color: m.color }}>{pct(m.winAmt, m.target || 1)}%</span>
                  </div>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${Math.min(pct(m.winAmt, m.target || 1), 100)}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Target vs Win vs Pipeline by Manager">
          {mgrData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barGap={3} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Target"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Win"      fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pipeline" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Sales Funnel" subtitle="Pipeline value and deal count per stage">
          {opps.length === 0 ? <Empty /> : <SalesFunnel data={funnelData} />}
        </Section>
      </div>

      {/* ── Planned vs Actual ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Planned vs Actual — by Manager" subtitle="Planned (target quota) vs actual won value per manager">
          {!hasPlanVsActual ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={planVsActualByManager} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Planned" name="Planned (Target)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual"  name="Actual (Won)"    fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Planned vs Actual — by Quarter" subtitle="Quarterly planned target vs actual won value (incl. undated wins)">
          {!hasPlanVsActual ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={planVsActualByQuarter} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Planned" name="Planned (Target)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual"  name="Actual (Won)"    fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Planned vs Actual — trend (line) ───────────────────────────────── */}
      <Section title="Planned vs Actual — Quarterly Trend" subtitle="Planned target vs actual won value across Q1–Q4">
        {!hasPlanVsActual ? <Empty /> : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={planVsActualTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="Planned" name="Planned (Target)" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Actual"  name="Actual (Won)"    stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Pipeline by Stage ─────────────────────────────────────────────── */}
      <Section title="Pipeline by Stage" subtitle="Value and count per stage">
        {opps.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {stageData.map(({ stage, count, value }) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-right"><span className="text-xs font-semibold text-gray-700">{stage}</span></div>
                <div className="flex-1">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(value / maxStageVal) * 100}%`, backgroundColor: STAGE_COLORS[stage] ?? '#94a3b8' }} />
                  </div>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <span className="text-sm font-bold text-gray-900">{fmtFull(value)}</span>
                  <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Quarterly ─────────────────────────────────────────────────────── */}
      <Section title="Quarterly Pipeline & Win" subtitle="Pipeline and won value by expected close quarter">
        {qtrData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={qtrData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="pipeline" name="Pipeline" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="win"      name="Win"      fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Win/Loss + Status ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Win vs Loss vs Active">
          {opps.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                {/* Zero-count slices are dropped (no "Lost 0%" label) and the
                    radius leaves room so labels don't clip at the card edge. */}
                <Pie
                  data={[
                    { name: 'Won', value: wins.length, fill: '#10b981' },
                    { name: 'Lost', value: losses.length, fill: '#ef4444' },
                    { name: 'Active', value: active.length, fill: '#3b82f6' },
                  ].filter((d) => d.value > 0)}
                  cx="50%" cy="50%" outerRadius={60} dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Loss Reasons">
          {lossData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={lossData} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} name="Deals" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Active Deals by Status">
          {statusData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData.filter((s) => s.count > 0).map((s) => ({ name: s.status, value: s.count }))} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                  {statusData.filter((s) => s.count > 0).map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] ?? PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Loss review ───────────────────────────────────────────────────── */}
      <Section title="Loss Review" subtitle="Every lost deal with its reason — the post-mortem list">
        {losses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No lost deals in this period. 🎉</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Opportunity', 'Account', 'Manager', 'Value', 'Reason', 'Details'].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${h === 'Value' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {[...losses].sort((a, b) => pipeVal(b) - pipeVal(a)).map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-gray-900">{o.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{o.customer_name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{(o.owner as string) ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-red-500">{fmtShort(pipeVal(o))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{o.loss_reason ?? 'Unknown'}</span>
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-xs text-gray-500" title={o.loss_description ?? ''}>{o.loss_description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Product breakdown ─────────────────────────────────────────────── */}
      <Section title="Performance by Product" subtitle="Pipeline, wins, and win rate per product">
        {prodData.length === 0 ? <Empty /> : (
          <>
            <div className="mb-3 grid grid-cols-6 gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-2">Product</div>
              <div className="text-right">Pipeline</div>
              <div className="text-right">Win Value</div>
              <div className="text-right">Deals</div>
              <div className="text-right">Win Rate</div>
            </div>
            <div className="space-y-2">
              {prodData.map(({ product, value, winValue, count, winRate }, i) => (
                <div key={product} className="grid grid-cols-6 gap-2 items-center rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{product}</span>
                  </div>
                  <div className="text-right text-sm text-gray-700">{fmtShort(value)}</div>
                  <div className="text-right text-sm font-semibold text-green-600">{fmtShort(winValue)}</div>
                  <div className="text-right text-sm text-gray-500">{count}</div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${winRate >= 50 ? 'bg-green-100 text-green-700' : winRate > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{winRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ── Country + Leaderboard ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Pipeline by Country" subtitle="Top 10 countries by deal value">
          {cntryData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {cntryData.map(({ country, count, value, wins: w }, i) => (
                <div key={country} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900">{country}</span>
                  <span className="text-xs text-green-600 font-semibold">{w} won</span>
                  <span className="text-sm font-bold text-gray-900 w-20 text-right">{fmtShort(value)}</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{count} deals</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Manager Leaderboard" subtitle="Ranked by total win value">
          {mgrData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {mgrData.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.total} deals · {m.rate}% win rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{fmtShort(m.winAmt)}</p>
                    <p className="text-xs text-gray-400">{fmtShort(m.pipeline)} active</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Full manager table ────────────────────────────────────────────── */}
      <Section title="Full Manager Performance Table" subtitle="Complete breakdown per sales manager">
        {mgrData.length === 0 ? <Empty /> : (
          <>
            <div className="mb-3 grid grid-cols-8 gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-2">Manager</div>
              <div className="text-right">Target</div>
              <div className="text-right">Win</div>
              <div className="text-right">Gap</div>
              <div className="text-right">Pipeline</div>
              <div className="text-right">Win Rate</div>
              <div className="text-right">Deals</div>
            </div>
            <div className="space-y-2">
              {mgrData.map((m) => (
                <div key={m.name} className="grid grid-cols-8 gap-2 items-center rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="col-span-2 text-sm font-semibold text-gray-900">{m.name}</div>
                  <div className="text-right text-sm text-gray-500">{m.target > 0 ? fmtShort(m.target) : '—'}</div>
                  <div className="text-right text-sm font-semibold text-green-600">{fmtShort(m.winAmt)}</div>
                  <div className={`text-right text-sm font-semibold ${m.gap <= 0 ? 'text-green-600' : 'text-red-500'}`}>{m.gap <= 0 ? '✓' : fmtShort(m.gap)}</div>
                  <div className="text-right text-sm text-gray-700">{fmtShort(m.pipeline)}</div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.rate >= 50 ? 'bg-green-100 text-green-700' : m.rate > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{m.rate}%</span>
                  </div>
                  <div className="text-right text-sm text-gray-500">{m.total}</div>
                </div>
              ))}
              <div className="grid grid-cols-8 gap-2 items-center border-t border-gray-200 pt-3 mt-1">
                <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gray-400">Total</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(overallTarget)}</div>
                <div className="text-right text-sm font-bold text-green-600">{fmtShort(mgrData.reduce((s, m) => s + m.winAmt, 0))}</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(Math.abs(mgrData.reduce((s, m) => s + m.gap, 0)))}</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(mgrData.reduce((s, m) => s + m.pipeline, 0))}</div>
                <div />
                <div className="text-right text-sm font-bold text-gray-500">{opps.length}</div>
              </div>
            </div>
          </>
        )}
      </Section>

    </div>
  )
}

// ── Sales Funnel as Pie Chart ─────────────────────────────────────────────────
function SalesFunnel({
  data,
}: {
  data: { stage: string; count: number; value: number; fill: string }[]
}) {
  const total = data.reduce((s, d) => s + d.count, 0)

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, count }: any) => {
    if (count === 0) return null
    const RADIAN  = Math.PI / 180
    const radius  = innerRadius + (outerRadius - innerRadius) * 0.5
    const x       = cx + radius * Math.cos(-midAngle * RADIAN)
    const y       = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {name}
      </text>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {/* Pie */}
      <div className="h-56 w-full sm:w-72 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="count"
              nameKey="stage"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((d) => <Cell key={d.stage} fill={d.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v: any, name: any) => [`${v} deals`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + stats */}
      <div className="flex-1 min-w-0 space-y-2">
        {data.map((d) => (
          <div key={d.stage} className="grid items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5"
            style={{ gridTemplateColumns: '12px auto 1fr auto auto' }}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
            <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{d.stage}</span>
            <span className="text-sm text-gray-500 text-center whitespace-nowrap">{d.count} deal{d.count !== 1 ? 's' : ''}</span>
            <span className="text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{fmtShort(d.value)}</span>
            <span className="w-9 text-right text-xs text-gray-400 whitespace-nowrap">
              {total > 0 ? `${Math.round((d.count / total) * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

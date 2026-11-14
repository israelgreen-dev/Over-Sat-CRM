'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { followUpStatus, inDaysISO } from './FollowUpField'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  type Opportunity,
  effectiveProbability,
  getProductLines,
  lineTotal,
} from '@/lib/opportunity'
import { type Lead } from './LeadsTab'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
function winVal(o: Opportunity) {
  return o.final_win_value || o.value || 0
}
// close_date is stored as a quarter string ("Q1-2026"), not a calendar date.
// Parse the quarter label from it, falling back to a real date if one is given.
function quarterLabel(cd: string | null | undefined): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null {
  if (!cd) return null
  const m = String(cd).match(/Q([1-4])/i)
  if (m) return `Q${m[1]}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
  const d = new Date(cd)
  if (!Number.isNaN(d.getTime()))
    return `Q${Math.floor(d.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
  return null
}
function pipeVal(o: Opportunity) {
  return o.value ?? 0
}
function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : 0
}

const STAGE_COLORS: Record<string, string> = {
  Discovery: '#3b82f6',
  Proposal: '#f59e0b',
  Negotiation: '#f97316',
  Win: '#10b981',
  Loss: '#ef4444',
}
const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#84cc16',
  '#6366f1',
]
const STATUS_COLORS: Record<string, string> = {
  'On Track': '#10b981',
  Risk: '#f59e0b',
  Critical: '#ef4444',
  'No Status': '#94a3b8',
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
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

  // ── Leads by Sales Manager (management report) ─────────────────────────────
  // Leads that carry at least one note (legacy description counts as one).
  const [notedLeadIds, setNotedLeadIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    supabase
      .from('lead_notes')
      .select('lead_id')
      .then(({ data }) => {
        if (!cancelled && data) setNotedLeadIds(new Set(data.map((n) => n.lead_id as string)))
      })
    return () => {
      cancelled = true
    }
  }, [leads])

  const leadReport = useMemo(() => {
    const todayISO = inDaysISO(0)
    const weekAhead = inDaysISO(7)
    const owners = Array.from(
      new Set([...managers, ...leads.map((l) => l.owner ?? '').filter(Boolean)]),
    )
    const isOpen = (l: Lead) => !['Dropped', 'Converted'].includes(l.status ?? 'New')
    const rows = owners
      .map((name) => {
        const ls = leads.filter((l) => (l.owner ?? '').toLowerCase() === name.toLowerCase())
        const st = (s: string) => ls.filter((l) => (l.status ?? 'New') === s).length
        return {
          name,
          total: ls.length,
          high: ls.filter((l) => (l.priority ?? '') === 'High').length,
          news: st('New'),
          contacted: st('Contacted'),
          qualified: st('Qualified'),
          converted: st('Converted'),
          withNotes: ls.filter((l) => notedLeadIds.has(l.id) || !!l.description?.trim()).length,
          overdue: ls.filter((l) => isOpen(l) && followUpStatus(l.follow_up_at) === 'overdue')
            .length,
          dueWeek: ls.filter(
            (l) =>
              isOpen(l) &&
              !!l.follow_up_at &&
              l.follow_up_at >= todayISO &&
              l.follow_up_at <= weekAhead,
          ).length,
          scheduled: ls.filter((l) => isOpen(l) && !!l.follow_up_at && l.follow_up_at > weekAhead)
            .length,
          noDate: ls.filter((l) => !l.follow_up_at).length,
        }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
    const keys = [
      'total',
      'high',
      'news',
      'contacted',
      'qualified',
      'converted',
      'withNotes',
      'overdue',
      'dueWeek',
      'scheduled',
      'noDate',
    ] as const
    const totals = Object.fromEntries(
      keys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]),
    ) as Record<(typeof keys)[number], number>
    return { rows, totals }
  }, [leads, managers, notedLeadIds])

  const opps = useMemo(() => {
    if (!selectedQuarter) return opportunities
    if (selectedQuarter === 'No Date') {
      return opportunities.filter((o) => !o.close_date)
    }
    return opportunities.filter((o) => quarterLabel(o.close_date) === selectedQuarter)
  }, [opportunities, selectedQuarter])
  const wins = opps.filter((o) => o.stage === 'Win')
  const losses = opps.filter((o) => o.stage === 'Loss')
  const active = opps.filter((o) => !['Win', 'Loss'].includes(o.stage))

  const totalPipeline = active.reduce((s, o) => s + pipeVal(o), 0)
  const totalWin = wins.reduce((s, o) => s + winVal(o), 0)
  // Forecast excludes lost deals so marking a deal as Loss is reflected here.
  const totalForecast = opps
    .filter((o) => o.stage !== 'Loss')
    .reduce((s, o) => s + pipeVal(o), 0)
  const totalLostValue = losses.reduce((s, o) => s + pipeVal(o), 0)
  const overallTarget = Object.values(managerTargets).reduce((s, v) => s + v, 0)
  const achievementPct = pct(totalWin, overallTarget)
  const winRateCount = pct(wins.length, opps.length)
  const winRateValue = pct(totalWin, totalForecast)
  const avgWin = wins.length > 0 ? totalWin / wins.length : 0
  const avgLoss = losses.length > 0 ? totalLostValue / losses.length : 0

  // Stage data
  const STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']
  const stageData = STAGES.map((stage) => {
    const s = opps.filter((o) => o.stage === stage)
    const val =
      stage === 'Win'
        ? s.reduce((a, o) => a + winVal(o), 0)
        : s.reduce((a, o) => a + pipeVal(o), 0)
    return { stage, count: s.length, value: val }
  })
  const maxStageVal = Math.max(...stageData.map((d) => d.value), 1)

  // Weighted pipeline
  const weightedPipeline = active.reduce(
    (s, o) => s + (pipeVal(o) * effectiveProbability(o, probabilityDefaults)) / 100,
    0,
  )

  // Funnel (by value)
  const funnelStages = ['Discovery', 'Proposal', 'Negotiation', 'Win']
  const funnelData = funnelStages.map((stage) => {
    const s = opps.filter((o) => o.stage === stage)
    const val =
      stage === 'Win'
        ? s.reduce((a, o) => a + winVal(o), 0)
        : s.reduce((a, o) => a + pipeVal(o), 0)
    return { stage, count: s.length, value: val, fill: STAGE_COLORS[stage] }
  })

  // Loss reasons
  const lossMap: Record<string, number> = {}
  losses.forEach((o) => {
    const r = o.loss_reason ?? 'Unknown'
    lossMap[r] = (lossMap[r] ?? 0) + 1
  })
  const lossData = Object.entries(lossMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Product
  // A deal can include several products; each product line is credited its own
  // value. Win values scale to the actual won amount so product totals add up.
  const prodMap: Record<
    string,
    { count: number; value: number; winCount: number; winValue: number }
  > = {}
  opps.forEach((o) => {
    const lines = getProductLines(o)
    const list =
      lines.length > 0
        ? lines
        : [{ id: '', product: 'Unspecified', price: pipeVal(o), quantity: 1 }]
    const deal = pipeVal(o)
    const winScale = o.stage === 'Win' && deal > 0 ? winVal(o) / deal : 0
    for (const l of list) {
      const p = l.product || 'Unspecified'
      const lv = lineTotal(l)
      if (!prodMap[p]) prodMap[p] = { count: 0, value: 0, winCount: 0, winValue: 0 }
      prodMap[p].count++
      prodMap[p].value += lv
      if (o.stage === 'Win') {
        prodMap[p].winCount++
        prodMap[p].winValue += lv * winScale
      }
    }
  })
  const prodData = Object.entries(prodMap)
    .map(([product, d]) => ({ product, ...d, winRate: pct(d.winCount, d.count) }))
    .sort((a, b) => b.value - a.value)

  // Country
  const cntryMap: Record<string, { count: number; value: number; wins: number }> = {}
  opps.forEach((o) => {
    const c = o.country || 'Unknown'
    if (!cntryMap[c]) cntryMap[c] = { count: 0, value: 0, wins: 0 }
    cntryMap[c].count++
    cntryMap[c].value += pipeVal(o)
    if (o.stage === 'Win') cntryMap[c].wins++
  })
  const cntryData = Object.entries(cntryMap)
    .map(([country, d]) => ({ country, ...d }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Quarterly
  const qtrMap: Record<string, { pipeline: number; win: number; count: number }> = {}
  opps.forEach((o) => {
    const q = o.close_date || 'No Date'
    if (!qtrMap[q]) qtrMap[q] = { pipeline: 0, win: 0, count: 0 }
    qtrMap[q].count++
    if (o.stage !== 'Loss') qtrMap[q].pipeline += pipeVal(o) // lost deals leave the pipeline
    if (o.stage === 'Win') qtrMap[q].win += winVal(o)
  })
  const qtrData = Object.entries(qtrMap)
    .map(([quarter, d]) => ({ quarter, ...d }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter))

  // Status
  const statusMap: Record<string, number> = {}
  active.forEach((o) => {
    const s = o.status || 'No Status'
    statusMap[s] = (statusMap[s] ?? 0) + 1
  })
  const statusData = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // Manager performance — only managers defined in Settings.
  const mgrData = managers
    .map((name, i) => {
      const m = opps.filter((o) => (o.owner as string)?.toLowerCase() === name.toLowerCase())
      const w = m.filter((o) => o.stage === 'Win')
      const a = m.filter((o) => !['Win', 'Loss'].includes(o.stage))
      const winAmt = w.reduce((s, o) => s + winVal(o), 0)
      const pipeline = a.reduce((s, o) => s + pipeVal(o), 0)
      const target = managerTargets[name] ?? 0
      const gap = target - winAmt
      const rate = pct(w.length, m.length)
      const color = managerColors[name] ?? PALETTE[i % PALETTE.length]
      return {
        name,
        winAmt,
        pipeline,
        target,
        gap,
        winCount: w.length,
        lossCount: m.filter((o) => o.stage === 'Loss').length,
        total: m.length,
        rate,
        color,
      }
    })
    .sort((a, b) => b.winAmt - a.winAmt)

  const barData = mgrData.map((m) => ({
    name: m.name,
    Target: m.target,
    Win: m.winAmt,
    Pipeline: m.pipeline,
  }))

  // ── Planned vs Actual ──────────────────────────────────────────────────────
  // Planned = target/quota, Actual = won value. Two views: per manager and per
  // quarter (with a "No Date" bucket for wins that have no close date).
  const planVsActualByManager = mgrData.map((m) => ({
    name: m.name,
    Planned: m.target,
    Actual: m.winAmt,
  }))

  const qPlanned = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  Object.values(quarterlyTargets).forEach((q) => {
    qPlanned.Q1 += q.q1
    qPlanned.Q2 += q.q2
    qPlanned.Q3 += q.q3
    qPlanned.Q4 += q.q4
  })
  const qActual: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, 'No Date': 0 }
  wins.forEach((o) => {
    const ql = quarterLabel(o.close_date)
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
    New: '#3b82f6',
    Contacted: '#f59e0b',
    Qualified: '#10b981',
    Converted: '#059669',
    Dropped: '#94a3b8',
  }
  const leadStageCounts = LEAD_STAGES.map((s) => ({
    status: s,
    count: leads.filter((l) => (l.status ?? 'New') === s).length,
    fill: LEAD_STAGE_COLORS[s],
  }))
  const convertedLeads = leadStageCounts.find((s) => s.status === 'Converted')?.count ?? 0
  const decidedLeads =
    convertedLeads + (leadStageCounts.find((s) => s.status === 'Dropped')?.count ?? 0)
  const leadConversion =
    decidedLeads > 0 ? Math.round((convertedLeads / decidedLeads) * 100) : 0
  const activeLeads = leads.length - decidedLeads
  const maxLeadCount = Math.max(...leadStageCounts.map((s) => s.count), 1)

  const leadMgrRows = managers
    .map((name) => {
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
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)

  // No-date wins would be invisible on the quarterly chart — surface them.
  const noDateWins = qActual['No Date'] ?? 0

  return (
    <div className="space-y-6">
      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        {availableYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Year:
            </span>
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => {
                  onYearChange?.(y)
                  setSelectedQuarter('')
                }}
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Quarter:
          </span>
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
        </div>
      </div>

      {/* ── Hero KPIs — the company picture in one row ────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <KpiTile
          label="Annual Target"
          value={fmtShort(overallTarget)}
          sub="sum of manager quotas"
          accent="border-blue-500"
        />
        <KpiTile
          label="Total Won"
          value={fmtShort(totalWin)}
          sub={`${wins.length} deal${wins.length !== 1 ? 's' : ''} closed`}
          accent="border-emerald-500"
          valueClass="text-emerald-600"
          progress={overallTarget > 0 ? Math.min(achievementPct, 100) : undefined}
          progressLabel={`${achievementPct}% of target`}
        />
        <KpiTile
          label="Gap to Target"
          value={fmtShort(Math.abs(overallTarget - totalWin))}
          sub={overallTarget - totalWin <= 0 ? 'target exceeded ✓' : 'left to close'}
          accent={overallTarget - totalWin <= 0 ? 'border-emerald-500' : 'border-amber-500'}
          valueClass={overallTarget - totalWin <= 0 ? 'text-emerald-600' : 'text-amber-600'}
        />
        <KpiTile
          label="Open Pipeline"
          value={fmtShort(totalPipeline)}
          sub={`${active.length} active deal${active.length !== 1 ? 's' : ''}`}
          accent="border-indigo-500"
          valueClass="text-indigo-600"
        />
        <KpiTile
          label="Weighted Forecast"
          value={fmtShort(weightedPipeline)}
          sub="pipeline × probability"
          accent="border-violet-500"
          valueClass="text-violet-600"
        />
        <KpiTile
          label="Win Rate"
          value={`${winRateCount}%`}
          sub={`${winRateValue}% by value · avg win ${fmtShort(avgWin)}`}
          accent="border-slate-400"
        />
      </div>

      {/* ── Target vs Actual ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Planned vs Actual" subtitle="Quarterly target against closed-won value">
          {hasPlanVsActual ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={planVsActualTrend} barGap={2} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmtFull(Number(v))} cursor={{ fill: '#f9fafb' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Planned" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
              {noDateWins > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  + {fmtShort(noDateWins)} won without a close date — not shown on the quarters
                  above.
                </p>
              )}
            </>
          ) : (
            <Empty />
          )}
        </Section>

        <Section
          title="Achievement by Manager"
          subtitle="Won value against each manager's annual target"
        >
          {mgrData.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3.5">
              {mgrData.map((m) => {
                const p = m.target > 0 ? Math.min(Math.round((m.winAmt / m.target) * 100), 100) : 0
                const achieved = m.target > 0 && m.winAmt >= m.target
                return (
                  <div key={m.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.name}
                      </span>
                      <span className="whitespace-nowrap text-xs tabular-nums text-gray-500">
                        {fmtShort(m.winAmt)} / {m.target > 0 ? fmtShort(m.target) : '—'}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 font-bold ${
                            achieved
                              ? 'bg-emerald-50 text-emerald-600'
                              : m.target > 0
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {m.target > 0
                            ? `${Math.round((m.winAmt / m.target) * 100)}%`
                            : 'no target'}
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${p}%`, backgroundColor: m.color }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {fmtShort(m.pipeline)} still in pipeline · {m.winCount} won · {m.lossCount}{' '}
                      lost
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ── Pipeline ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Pipeline by Stage"
          subtitle="Deal value and count at every stage of the funnel"
        >
          {opps.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {stageData.map(({ stage, count, value }) => (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right text-xs font-semibold text-gray-700">
                    {stage}
                  </div>
                  <div className="flex-1">
                    <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(value / maxStageVal) * 100}%`,
                          backgroundColor: STAGE_COLORS[stage],
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-28 shrink-0 text-right text-xs tabular-nums">
                    <span className="font-bold text-gray-900">{fmtShort(value)}</span>
                    <span className="ml-1 text-gray-400">· {count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Open Deal Health"
          subtitle="Status of active deals, and what a typical outcome is worth"
        >
          {active.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                    strokeWidth={2}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${Number(v)} deals`, String(n)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="min-w-[160px] flex-1 space-y-2">
                {statusData.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] ?? '#94a3b8' }}
                      />
                      {s.status}
                    </span>
                    <span className="font-bold tabular-nums text-gray-900">{s.count}</span>
                  </div>
                ))}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                      Avg Won Deal
                    </p>
                    <p className="text-sm font-bold text-emerald-700">{fmtShort(avgWin)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
                      Avg Lost Deal
                    </p>
                    <p className="text-sm font-bold text-red-600">{fmtShort(avgLoss)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Lead engine & losses ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Lead Engine"
          subtitle="Top of the funnel — lead status and conversion into opportunities"
        >
          {leads.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                  {activeLeads} active
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                  {convertedLeads} converted
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${leadConversion >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
                >
                  {leadConversion}% conversion
                </span>
              </div>
              <div className="space-y-2.5">
                {leadStageCounts.map(({ status, count, fill }) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-right text-xs font-semibold text-gray-700">
                      {status}
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(count / maxLeadCount) * 100}%`,
                            backgroundColor: fill,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-gray-900">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="Loss Review" subtitle="Why deals are lost — learn from every closed-lost">
          {losses.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No lost deals in this period. 🎉
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                  {losses.length} lost · {fmtShort(totalLostValue)}
                </span>
              </div>
              <div className="space-y-2.5">
                {lossData.map(({ reason, count }) => (
                  <div key={reason} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 truncate text-right text-xs font-semibold text-gray-700">
                      {reason}
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-red-400 transition-all"
                          style={{ width: `${(count / losses.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-gray-900">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      {/* ── Where the business is ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Revenue by Product" subtitle="Deal value per product across the pipeline">
          {prodData.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2.5">
              {prodData.slice(0, 8).map((p) => (
                <div key={p.product} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 truncate text-right text-xs font-semibold text-gray-700">
                    {p.product}
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${(p.value / (prodData[0]?.value || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 shrink-0 text-right text-xs tabular-nums">
                    <span className="font-bold text-gray-900">{fmtShort(p.value)}</span>
                    <span className="ml-1 text-gray-400">
                      · {p.count} deal{p.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Pipeline by Country" subtitle="Top markets by total deal value">
          {cntryData.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2.5">
              {cntryData.slice(0, 8).map((c) => (
                <div key={c.country} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 truncate text-right text-xs font-semibold text-gray-700">
                    {c.country}
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-cyan-600 transition-all"
                        style={{ width: `${(c.value / (cntryData[0]?.value || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 shrink-0 text-right text-xs tabular-nums">
                    <span className="font-bold text-gray-900">{fmtShort(c.value)}</span>
                    <span className="ml-1 text-gray-400">
                      · {c.count} deal{c.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
      {/* ── Leads by Sales Manager (management report) ────────────────────── */}
      {leadReport.rows.length > 0 && (
        <Section
          title="Leads by Sales Manager"
          subtitle="Workload, status mix and follow-up discipline per manager — the management view"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  {[
                    'Sales Manager',
                    'Total Leads',
                    'High Priority',
                    'New',
                    'Contacted',
                    'Qualified',
                    'Converted',
                    'With Notes',
                    'Follow-Up Overdue',
                    'Due This Week',
                    'Follow-Up Scheduled',
                    'No Follow-Up Date',
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold ${i === 0 ? 'rounded-l-lg text-left' : 'text-center'} ${i === 11 ? 'rounded-r-lg' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leadReport.rows.map((r) => (
                  <tr key={r.name} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: managerColors[r.name] ?? '#94a3b8' }}
                        />
                        {r.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums text-gray-900">
                      {r.total}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.high > 0 ? <span className="font-semibold text-red-600">{r.high}</span> : 0}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-blue-600">{r.news}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-amber-600">
                      {r.contacted}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-green-600">
                      {r.qualified}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-emerald-600">
                      {r.converted}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-700">
                      {r.withNotes}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.overdue > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-600">
                          {r.overdue}
                        </span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-amber-600">
                      {r.dueWeek}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-700">
                      {r.scheduled}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.noDate > 0 ? (
                        <span className="font-semibold text-gray-500">{r.noDate}</span>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-gray-900">
                  <td className="whitespace-nowrap rounded-l-lg px-3 py-2.5">TOTAL</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{leadReport.totals.total}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{leadReport.totals.high}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{leadReport.totals.news}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.contacted}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.qualified}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.converted}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.withNotes}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-red-600">
                    {leadReport.totals.overdue}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.dueWeek}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.scheduled}
                  </td>
                  <td className="rounded-r-lg px-3 py-2.5 text-center tabular-nums">
                    {leadReport.totals.noDate}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Hero KPI tile ─────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  sub,
  accent,
  valueClass = 'text-slate-900',
  progress,
  progressLabel,
}: {
  label: string
  value: string
  sub?: string
  /** Tailwind border-color class for the top accent. */
  accent: string
  valueClass?: string
  /** 0-100 — renders a slim progress bar under the value. */
  progress?: number
  progressLabel?: string
}) {
  return (
    <div
      className={`rounded-xl border border-gray-100 border-t-4 ${accent} bg-white p-4 shadow-sm transition-shadow hover:shadow-md`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
      {progress !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progressLabel && <p className="mt-1 text-[11px] text-gray-400">{progressLabel}</p>}
        </div>
      )}
      {sub && <p className="mt-1 text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

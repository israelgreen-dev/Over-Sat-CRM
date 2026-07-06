'use client'

import { useMemo, memo } from 'react'
import { toUSD } from '@/lib/currency'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { type Opportunity } from './OpportunitiesTable'
import { type Lead } from './LeadsTab'

// ── Constants ─────────────────────────────────────────────────────────────────
export const MANAGER_TARGETS: Record<string, number> = {}
export const MANAGER_COLORS:  Record<string, string>  = {}

const STAGE_COLORS: Record<string, string> = {
  Discovery:   '#3b82f6',
  Proposal:    '#f59e0b',
  Negotiation: '#f97316',
  Win:         '#10b981',
  Loss:        '#ef4444',
}

const MANAGERS = Object.keys(MANAGER_TARGETS)
const STAGES   = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss'] as const

// ── Formatters ────────────────────────────────────────────────────────────────
// Intl.NumberFormat is expensive to construct — hoist to module level so it's
// created once per JS module load, not once per component render or per call.
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtFull(n: number) { return currencyFmt.format(n) }

// ── Component ─────────────────────────────────────────────────────────────────
function DashboardAnalytics({
  opportunities,
  viewAs = 'head_of_sales',
  overallTarget = 0,
  managerTargets = MANAGER_TARGETS,
  managers = MANAGERS,
  managerColors: managerColorsProp = MANAGER_COLORS,
  leads = [],
}: {
  opportunities: Opportunity[]
  viewAs?: string
  overallTarget?: number
  managerTargets?: Record<string, number>
  managers?: string[]
  managerColors?: Record<string, string>
  leads?: Lead[]
}) {
  const isHoS        = viewAs === 'head_of_sales'
  const managerColors = managerColorsProp

  // ── Aggregates ──────────────────────────────────────────────────────────
  // Per-manager performance rows — only managers defined in Settings.
  const managerRows = useMemo(
    () => managers.map((name) => {
      const opps = opportunities.filter(
        (o) => (o.owner as string)?.toLowerCase() === name.toLowerCase(),
      )
      // Forecast excludes lost deals so marking a deal as Loss is reflected here.
      const forecast = opps
        .filter((o) => o.stage !== 'Loss')
        .reduce((s, o) => s + toUSD(o.value ?? 0, (o as any).currency), 0)
      const closed   = opps
        .filter((o) => o.stage === 'Win')
        .reduce((s, o) => s + toUSD((o as any).final_win_value || o.value || 0, (o as any).currency), 0)
      const target = managerTargets[name] ?? 0
      const pct    = target > 0 ? Math.min(Math.round((closed / target) * 100), 999) : 0
      const gap    = target - closed
      return { name, target, forecast, closed, pct, gap }
    }),
    [managers, opportunities, managerTargets],
  )

  // Scope-level KPI scalars — single pass over opportunities.
  const { scopeTarget, closedValue, gapToTarget, globalPct } = useMemo(() => {
    const scopeTarget   = isHoS ? overallTarget : (managerTargets[viewAs] ?? 0)
    const closedValue   = opportunities
      .filter((o) => o.stage === 'Win')
      .reduce((s, o) => s + toUSD((o as any).final_win_value || o.value || 0, (o as any).currency), 0)
    return {
      scopeTarget,
      closedValue,
      gapToTarget: scopeTarget - closedValue,
      globalPct:   scopeTarget > 0 ? Math.min(Math.round((closedValue / scopeTarget) * 100), 100) : 0,
    }
  }, [opportunities, overallTarget, isHoS, managerTargets, viewAs])

  // Stage breakdown — one pass per stage (5 stages × O(n)).
  const stageData = useMemo(
    () => STAGES.map((stage) => {
      const opps  = opportunities.filter((o) => o.stage === stage)
      const value = opps.reduce(
        (s, o) => s + toUSD(stage === 'Win' ? ((o as any).final_win_value || o.value || 0) : (o.value ?? 0), (o as any).currency),
        0,
      )
      return { stage, count: opps.length, value }
    }),
    [opportunities],
  )

  const maxStageVal = useMemo(
    () => Math.max(...stageData.map((d) => d.value), 1),
    [stageData],
  )

  const hosBarData   = useMemo(
    // Target shown is what's left to close — won deals reduce the target.
    () => managerRows.map((m) => ({ name: m.name, Target: Math.max(0, m.target - m.closed), Forecast: m.forecast, Win: m.closed })),
    [managerRows],
  )
  const stageBarData = useMemo(
    () => stageData.map((s) => ({ name: s.stage, Deals: s.count, Value: s.value })),
    [stageData],
  )

  return (
    <div className="space-y-6">

      {/* ── KPI Summary ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label={isHoS ? 'Overall Target' : 'My Target'}
          value={fmtFull(scopeTarget)}
          caption={isHoS ? 'Annual team target' : 'Your personal quota'}
          accent="border-t-4 border-blue-500"
        />
        <KpiCard
          label={isHoS ? 'Total Win' : 'My Win'}
          value={fmtFull(closedValue)}
          caption="Sum of won opportunities"
          valueClass="text-emerald-600"
          accent="border-t-4 border-emerald-500"
        />
        <KpiCard
          label="Gap to Target"
          value={fmtFull(Math.abs(gapToTarget))}
          caption={gapToTarget <= 0 ? 'Target exceeded ✓' : 'Remaining to close'}
          valueClass={gapToTarget <= 0 ? 'text-emerald-600' : 'text-orange-500'}
          accent={gapToTarget <= 0 ? 'border-t-4 border-emerald-500' : 'border-t-4 border-orange-400'}
        />
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md border-t-4 border-indigo-500">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Progress to Target
          </p>
          <p className="tabular-nums text-3xl font-bold leading-none text-slate-900">{globalPct}%</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700"
              style={{ width: `${globalPct}%` }}
            />
          </div>
          <p className="mt-2 tabular-nums text-xs text-gray-400">
            {fmtShort(closedValue)} of {fmtShort(scopeTarget)}
          </p>
        </div>
      </div>

      {/* ── Leads at a glance ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md border-t-4 border-emerald-500">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Leads at a Glance</h3>
            <p className="mt-0.5 text-xs text-gray-400">Top of the funnel — manage them in the Leads tab</p>
          </div>
          {(() => {
            const conv = leads.filter((l) => (l.status ?? '') === 'Converted').length
            const decided = conv + leads.filter((l) => (l.status ?? '') === 'Dropped').length
            return decided > 0 ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                {Math.round((conv / decided) * 100)}% conversion
              </span>
            ) : null
          })()}
        </div>
        {leads.length === 0 ? (
          <p className="py-3 text-sm text-gray-400">No leads yet — click <span className="font-semibold text-emerald-600">+ New Lead</span> in the top bar to capture your first prospect.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([
              ['New',       'text-blue-600',    'bg-blue-50'],
              ['Contacted', 'text-amber-600',   'bg-amber-50'],
              ['Qualified', 'text-green-600',   'bg-green-50'],
              ['Converted', 'text-emerald-600', 'bg-emerald-50'],
              ['Dropped',   'text-gray-400',    'bg-gray-50'],
            ] as const).map(([status, txt, bg]) => (
              <div key={status} className={`rounded-lg ${bg} px-4 py-3 text-center`}>
                <p className={`tabular-nums text-2xl font-bold ${txt}`}>
                  {leads.filter((l) => (l.status ?? 'New') === status).length}
                </p>
                <p className="mt-0.5 text-xs font-medium text-gray-500">{status}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Bar chart — HoS: Target vs Forecast per manager | Manager: value by stage */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <h3 className="text-sm font-bold text-gray-900">
            {isHoS ? 'Target vs Forecast by Manager' : 'My Pipeline by Stage'}
          </h3>
          <p className="mb-4 mt-0.5 text-xs text-gray-400">
            {isHoS ? 'Side-by-side comparison per sales rep' : 'Deal value distribution across stages'}
          </p>
          <ResponsiveContainer width="100%" height={230}>
            {isHoS ? (
              <BarChart data={hosBarData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Target"   name="Target Left" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Win"      fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={stageBarData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v, name) => name === 'Value' ? fmtFull(Number(v)) : v} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Value" fill={MANAGER_COLORS[viewAs] ?? '#3b82f6'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Deals" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Pipeline by Stage */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <h3 className="text-sm font-bold text-gray-900">Pipeline by Stage</h3>
          <p className="mb-5 mt-0.5 text-xs text-gray-400">
            {isHoS ? 'All-team deal value across stages' : 'Your deal value across stages'}
          </p>
          <div className="space-y-3.5">
            {stageData.map(({ stage, count, value }) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <span className="text-xs font-semibold text-gray-700">{stage}</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(value / maxStageVal) * 100}%`,
                        backgroundColor: STAGE_COLORS[stage] ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <span className="tabular-nums text-sm font-bold text-gray-900">{fmtFull(value)}</span>
                  <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Manager Performance Feed — HoS only ───────────────────────────── */}
      {isHoS && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <h3 className="mb-5 text-sm font-bold text-gray-900">Sales Manager Performance</h3>
          <div className="space-y-4">
            <div className="mb-1 flex items-center gap-4 border-b border-gray-50 pb-2">
              <div className="w-32 shrink-0" />
              <div className="flex-1" />
              <div className="w-12 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">%</span>
              </div>
              <div className="w-44 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Overall Target</span>
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-green-600">Win</span>
              </div>
            </div>

            {managerRows.map((m) => (
              <div key={m.name} className="flex items-center gap-4">
                <div className="w-32 min-w-0 shrink-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(m.pct, 100)}%`,
                        backgroundColor: managerColors[m.name] ?? '#3b82f6',
                      }}
                    />
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <span className="tabular-nums text-sm font-bold" style={{ color: managerColors[m.name] ?? '#3b82f6' }}>
                    {m.pct}%
                  </span>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <span className="tabular-nums text-sm font-semibold text-gray-900">{fmtFull(m.target)}</span>
                </div>
                <div className="w-36 shrink-0 text-right">
                  <span className="tabular-nums text-sm font-semibold text-green-600">{fmtFull(m.closed)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
            <div className="w-32 shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total</p>
            </div>
            <div className="flex-1" />
            <div className="w-12 shrink-0" />
            <div className="w-44 shrink-0 text-right">
              <span className="tabular-nums text-sm font-bold text-gray-900">
                {fmtFull(managerRows.reduce((s, m) => s + m.target, 0))}
              </span>
            </div>
            <div className="w-36 shrink-0 text-right">
              <span className="tabular-nums text-sm font-bold text-green-600">
                {fmtFull(managerRows.reduce((s, m) => s + m.closed, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Win Deals — individual manager only ─────────────────────────────── */}
      {!isHoS && closedValue > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <h3 className="mb-1 text-sm font-bold text-gray-900">Win Deals</h3>
          <p className="mb-4 text-xs text-gray-400">Won opportunities contributing to quota</p>
          <div className="space-y-0.5">
            {opportunities
              .filter((o) => o.stage === 'Win')
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
              .map((o) => (
                <div key={o.id} className="-mx-3 flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-gray-50">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate text-sm font-semibold text-gray-900">{o.name ?? '—'}</p>
                    <p className="truncate text-xs text-gray-400">{o.customer_name ?? ''}{o.product ? ` · ${o.product}` : ''}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm font-bold text-green-600">
                    {fmtFull(toUSD((o as any).final_win_value || o.value || 0, (o as any).currency))}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  )
}

// memo prevents re-renders when Dashboard re-renders for unrelated state changes
// (modal open/close, dropdown toggle) without any of the analytics props changing.
export default memo(DashboardAnalytics)

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, caption, valueClass = 'text-slate-900', accent = '',
}: {
  label: string; value: string; caption: string; valueClass?: string; accent?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md ${accent}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`tabular-nums text-3xl font-bold leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-400">{caption}</p>
    </div>
  )
}

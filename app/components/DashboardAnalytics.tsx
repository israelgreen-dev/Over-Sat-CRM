'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { type Opportunity } from './OpportunitiesTable'

// ── Constants ─────────────────────────────────────────────────────────────────
export const GLOBAL_TARGET = 3_200_000

export const MANAGER_TARGETS: Record<string, number> = {
  Yossi:   620_000,
  Shmulik: 560_000,
  Michel:  500_000,
  Tzachi:  540_000,
  Green:   480_000,
  Johnny:  500_000,
}

export const MANAGER_COLORS: Record<string, string> = {
  Yossi:   '#3b82f6',
  Shmulik: '#10b981',
  Michel:  '#f59e0b',
  Tzachi:  '#8b5cf6',
  Green:   '#ef4444',
  Johnny:  '#06b6d4',
}

const STAGE_COLORS: Record<string, string> = {
  Discovery:     '#3b82f6',
  Proposal:    '#f59e0b',
  Negotiation: '#f97316',
  Win:         '#10b981',
  Loss:        '#ef4444',
}

const MANAGERS = Object.keys(MANAGER_TARGETS)
const STAGES   = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardAnalytics({
  opportunities,
  viewAs = 'head_of_sales',
  overallTarget = GLOBAL_TARGET,
  managerTargets = MANAGER_TARGETS,
  managers = MANAGERS,
  managerColors: managerColorsProp = MANAGER_COLORS,
}: {
  opportunities: Opportunity[]
  viewAs?: string
  overallTarget?: number
  managerTargets?: Record<string, number>
  managers?: string[]
  managerColors?: Record<string, string>
}) {
  const isHoS = viewAs === 'head_of_sales'
  const managerColors = managerColorsProp

  // ── Aggregates ──────────────────────────────────────────────────────────
  const managerRows = managers.map((name) => {
    const opps     = opportunities.filter(
      (o) => (o.owner as string)?.toLowerCase() === name.toLowerCase(),
    )
    const forecast = opps.reduce((s, o) => s + (o.value ?? 0), 0)
    const closed   = opps.filter((o) => o.stage === 'Win').reduce((s, o) => s + ((o as any).final_win_value ?? 0), 0)
    const target   = managerTargets[name] ?? 0
    const pct      = target > 0 ? Math.min(Math.round((forecast / target) * 100), 999) : 0
    return { name, target, forecast, closed, pct }
  })

  // Active scope totals (already filtered by Dashboard when viewAs is a manager)
  const scopeTarget   = isHoS ? overallTarget : (managerTargets[viewAs] ?? 0)
  const totalForecast = opportunities.reduce((s, o) => s + (o.value ?? 0), 0)
  const closedValue   = opportunities.filter((o) => o.stage === 'Win').reduce((s, o) => s + ((o as any).final_win_value ?? 0), 0)
  const gapToTarget   = scopeTarget - totalForecast
  const globalPct     = scopeTarget > 0 ? Math.min(Math.round((totalForecast / scopeTarget) * 100), 100) : 0

  // Stage data (scoped)
  const stageData  = STAGES.map((stage) => {
    const opps  = opportunities.filter((o) => o.stage === stage)
    const value = opps.reduce((s, o) => s + (o.value ?? 0), 0)
    return { stage, count: opps.length, value }
  })
  const maxStageVal = Math.max(...stageData.map((d) => d.value), 1)

  // Bar-chart data — HoS compares all managers; manager sees their own stages
  const barChartData = isHoS
    ? managerRows.map((m) => ({ name: m.name, Target: m.target, Forecast: m.forecast, Actual: m.closed }))
    : stageData.map((s) => ({ name: s.stage, Deals: s.count, Value: s.value }))

  return (
    <div className="space-y-6">

      {/* ── KPI Summary ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label={isHoS ? 'Overall Target' : 'My Target'}
          value={fmtFull(scopeTarget)}
          caption={isHoS ? 'Annual team target' : 'Your personal quota'}
        />
        <KpiCard
          label={isHoS ? 'Total Forecast' : 'My Forecast'}
          value={fmtFull(totalForecast)}
          caption="Sum of active deal values"
        />
        <KpiCard
          label="Gap to Target"
          value={fmtFull(Math.abs(gapToTarget))}
          caption={gapToTarget <= 0 ? 'Target exceeded ✓' : 'Remaining to close'}
          valueClass={gapToTarget <= 0 ? 'text-green-600' : 'text-red-500'}
        />
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Progress to Target
          </p>
          <p className="text-3xl font-bold leading-none text-slate-900">{globalPct}%</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${globalPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {fmtShort(totalForecast)} of {fmtShort(scopeTarget)}
          </p>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Bar chart — HoS: Target vs Forecast per manager | Manager: value by stage */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">
            {isHoS ? 'Target vs Forecast by Manager' : 'My Pipeline by Stage'}
          </h3>
          <p className="mb-4 mt-0.5 text-xs text-gray-400">
            {isHoS ? 'Side-by-side comparison per sales rep' : 'Deal value distribution across stages'}
          </p>
          <ResponsiveContainer width="100%" height={230}>
            {isHoS ? (
              <BarChart data={barChartData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Target"   fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual"   fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={barChartData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v: number, name: string) => name === 'Value' ? fmtFull(v) : v} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Value" fill={MANAGER_COLORS[viewAs] ?? '#3b82f6'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Deals" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Pipeline by Stage (always shown) */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">Pipeline by Stage</h3>
          <p className="mb-5 mt-0.5 text-xs text-gray-400">
            {isHoS ? 'All-team deal value across stages' : 'Your deal value across stages'}
          </p>
          <div className="space-y-4">
            {stageData.map(({ stage, count, value }) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-right">
                  <span className="text-xs font-semibold text-gray-700">{stage}</span>
                </div>
                <div className="flex-1">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(value / maxStageVal) * 100}%`,
                        backgroundColor: STAGE_COLORS[stage] ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
                <div className="w-36 shrink-0 text-right">
                  <span className="text-sm font-bold text-gray-900">{fmtFull(value)}</span>
                  <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Manager Performance Feed — HoS only ───────────────────────────── */}
      {isHoS && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-5 text-sm font-bold text-gray-900">Sales Manager Performance</h3>
          <div className="space-y-5">
            {/* Column headers */}
            <div className="mb-2 flex items-center gap-4 px-0">
              <div className="w-20 shrink-0" />
              <div className="flex-1" />
              <div className="w-12 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">%</span>
              </div>
              <div className="w-52 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Forecast / Target</span>
              </div>
              <div className="w-32 shrink-0 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-green-600">Win (Actual)</span>
              </div>
            </div>

            {managerRows.map((m) => (
              <div key={m.name} className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-bold text-gray-900">{m.name}</p>
                </div>
                <div className="flex-1">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(m.pct, 100)}%`,
                        backgroundColor: managerColors[m.name] ?? '#3b82f6',
                      }}
                    />
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <span className="text-sm font-bold" style={{ color: managerColors[m.name] ?? '#3b82f6' }}>
                    {m.pct}%
                  </span>
                </div>
                <div className="w-52 shrink-0 text-right">
                  <span className="text-sm font-bold text-gray-900">{fmtFull(m.forecast)}</span>
                  <span className="mx-1 text-xs text-gray-400">/</span>
                  <span className="text-sm text-gray-500">{fmtFull(m.target)}</span>
                </div>
                <div className="w-32 shrink-0 text-right">
                  <span className="text-sm font-semibold text-green-600">{fmtFull(m.closed)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Totals row */}
          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
            <div className="w-20 shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total</p>
            </div>
            <div className="flex-1" />
            <div className="w-12 shrink-0" />
            <div className="w-52 shrink-0 text-right">
              <span className="text-sm font-bold text-gray-900">
                {fmtFull(managerRows.reduce((s, m) => s + m.forecast, 0))}
              </span>
              <span className="mx-1 text-xs text-gray-400">/</span>
              <span className="text-sm text-gray-500">{fmtFull(overallTarget)}</span>
            </div>
            <div className="w-32 shrink-0 text-right">
              <span className="text-sm font-bold text-green-600">
                {fmtFull(managerRows.reduce((s, m) => s + m.closed, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Win Deals — individual manager only ─────────────────────────────── */}
      {!isHoS && closedValue > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-gray-900">Win Deals</h3>
          <p className="mb-4 text-xs text-gray-400">Won opportunities contributing to quota</p>
          <div className="divide-y divide-gray-50">
            {opportunities
              .filter((o) => o.stage === 'Win')
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
              .map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{o.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{o.customer_name ?? ''}{o.product ? ` · ${o.product}` : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">{fmtFull(o.value ?? 0)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, caption, valueClass = 'text-slate-900',
}: {
  label: string; value: string; caption: string; valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-3xl font-bold leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-400">{caption}</p>
    </div>
  )
}

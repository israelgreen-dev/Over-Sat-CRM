'use client'

import { type Opportunity } from './OpportunitiesTable'
import { MANAGER_TARGETS, MANAGER_COLORS } from './DashboardAnalytics'

const MANAGERS = Object.keys(MANAGER_TARGETS)

const STAGE_DOT: Record<string, string> = {
  Discovery:     'bg-blue-400',
  Proposal:    'bg-yellow-400',
  Negotiation: 'bg-orange-400',
  Win:         'bg-green-500',
  Loss:        'bg-red-400',
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function ManagersTab({
  opportunities,
  managerTargets = MANAGER_TARGETS,
  managers: managerNames = MANAGERS,
  managerColors: managerColorsProp = MANAGER_COLORS,
}: {
  opportunities: Opportunity[]
  managerTargets?: Record<string, number>
  managers?: string[]
  managerColors?: Record<string, string>
}) {
  const managerColors = managerColorsProp
  const managers = managerNames.map((name) => {
    const opps     = opportunities.filter(
      (o) => (o.owner as string)?.toLowerCase() === name.toLowerCase(),
    )
    const forecast = opps.reduce((s, o) => s + (o.value ?? 0), 0)
    const closed   = opps.filter((o) => o.stage === 'Win').reduce((s, o) => s + ((o as any).final_win_value ?? 0), 0)
    const open     = opps.filter((o) => !['Win', 'Loss'].includes(o.stage)).reduce((s, o) => s + (o.value ?? 0), 0)
    const target   = managerTargets[name] ?? 0
    const pct      = target > 0 ? Math.min(Math.round((forecast / target) * 100), 999) : 0
    const topDeals = [...opps].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3)
    return { name, target, forecast, closed, open, pct, topDeals, count: opps.length }
  })

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {managers.map((m) => (
        <ManagerCard key={m.name} m={m} color={MANAGER_COLORS[m.name] ?? '#94a3b8'} />
      ))}
    </div>
  )
}

type ManagerRow = {
  name: string
  target: number
  forecast: number
  closed: number
  open: number
  pct: number
  count: number
  topDeals: Opportunity[]
}

function ManagerCard({ m, color }: { m: ManagerRow; color: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Colored top strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="flex-1 p-5">
        {/* Header row */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {m.name[0]}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{m.name}</h3>
            <p className="text-xs text-gray-400">{m.count} opportunit{m.count === 1 ? 'y' : 'ies'}</p>
          </div>
          <span className="text-xl font-bold" style={{ color }}>
            {m.pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Achievement</span>
            <span className="font-medium text-gray-700">
              {fmtShort(m.forecast)} / {fmtShort(m.target)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(m.pct, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-3 divide-x divide-gray-100 rounded-lg bg-gray-50 py-2">
          <div className="px-3 text-center">
            <p className="text-xs text-gray-400">Target</p>
            <p className="text-sm font-bold text-gray-900">{fmtShort(m.target)}</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xs text-gray-400">Win</p>
            <p className="text-sm font-bold text-green-600">{fmtShort(m.closed)}</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xs text-gray-400">Open</p>
            <p className="text-sm font-bold text-blue-600">{fmtShort(m.open)}</p>
          </div>
        </div>

        {/* Top deals */}
        {m.topDeals.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Top Deals
            </p>
            <ul className="space-y-2">
              {m.topDeals.map((deal) => (
                <li key={deal.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[deal.stage] ?? 'bg-gray-300'}`}
                    />
                    <span className="truncate text-xs text-gray-700">
                      {(deal.name as string) ?? (deal.customer_name as string) ?? '—'}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-gray-900">
                    {fmtFull(deal.value ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-400">No deals assigned yet.</p>
        )}
      </div>
    </div>
  )
}

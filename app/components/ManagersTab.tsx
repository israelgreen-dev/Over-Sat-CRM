'use client'

import { useState } from 'react'
import { type Opportunity } from './OpportunitiesTable'
import { MANAGER_TARGETS, MANAGER_COLORS } from './DashboardAnalytics'
import ManagerDocuments from './ManagerDocuments'

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
  uploaderName = '',
}: {
  opportunities: Opportunity[]
  managerTargets?: Record<string, number>
  managers?: string[]
  managerColors?: Record<string, string>
  uploaderName?: string
}) {
  const managerColors = managerColorsProp
  const managers = managerNames.map((name) => {
    const opps     = opportunities.filter(
      (o) => (o.owner as string)?.toLowerCase() === name.toLowerCase(),
    )
    const forecast = opps.filter((o) => o.stage !== 'Loss').reduce((s, o) => s + (o.value ?? 0), 0)
    const closed   = opps.filter((o) => o.stage === 'Win').reduce((s, o) => s + ((o as any).final_win_value ?? o.value ?? 0), 0)
    const open     = opps.filter((o) => !['Win', 'Loss'].includes(o.stage)).reduce((s, o) => s + (o.value ?? 0), 0)
    const target   = managerTargets[name] ?? 0
    const pct      = target > 0 ? Math.min(Math.round((closed / target) * 100), 999) : 0
    const topDeals = [...opps].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3)
    return { name, target, forecast, closed, open, pct, topDeals, count: opps.length }
  })

  const [selected, setSelected] = useState<string | null>(null)

  if (selected) {
    const m = managers.find((x) => x.name === selected)!
    const color = managerColors[selected] ?? '#94a3b8'
    const opps  = opportunities.filter(
      (o) => (o.owner as string)?.toLowerCase() === selected.toLowerCase(),
    )
    return (
      <ManagerDrillDown
        m={m}
        color={color}
        opps={opps}
        onBack={() => setSelected(null)}
        uploaderName={uploaderName}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {managers.map((m) => (
        <ManagerCard
          key={m.name}
          m={m}
          color={managerColors[m.name] ?? '#94a3b8'}
          onClick={() => setSelected(m.name)}
        />
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

const STAGE_ORDER = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']

function ManagerDrillDown({
  m, color, opps, onBack, uploaderName,
}: {
  m: ManagerRow
  color: string
  opps: Opportunity[]
  onBack: () => void
  uploaderName: string
}) {
  const sorted = [...opps].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || (b.value ?? 0) - (a.value ?? 0),
  )

  return (
    <div>
      {/* Back button + header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Sales Managers
        </button>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {m.name[0]}
          </div>
          <h2 className="text-base font-bold text-gray-900">{m.name}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {opps.length} opportunit{opps.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Target',   value: fmtShort(m.target),   cls: 'text-gray-900' },
          { label: 'Won',      value: fmtShort(m.closed),   cls: 'text-green-600' },
          { label: 'Open Pipeline', value: fmtShort(m.open), cls: 'text-blue-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Opportunities table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {sorted.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No opportunities assigned yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 text-left">Opportunity</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-left">Close Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.customer_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.stage === 'Win'         ? 'bg-green-100 text-green-700' :
                      o.stage === 'Loss'        ? 'bg-red-100 text-red-600' :
                      o.stage === 'Negotiation'? 'bg-orange-100 text-orange-700' :
                      o.stage === 'Proposal'   ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-blue-100 text-blue-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[o.stage] ?? 'bg-gray-300'}`} />
                      {o.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{(o.product as string) ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtFull(o.value ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-500">{(o as any).close_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documents */}
      <ManagerDocuments
        managerName={m.name}
        uploaderName={uploaderName}
        color={color}
      />
    </div>
  )
}

function ManagerCard({ m, color, onClick }: { m: ManagerRow; color: string; onClick: () => void }) {
  return (
    <div
      className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
      onClick={onClick}
    >
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
              {fmtShort(m.closed)} / {fmtShort(m.target)}
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
                      className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[deal.stage as string] ?? 'bg-gray-300'}`}
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

'use client'

import { useState, useMemo, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { toUSD } from '@/lib/currency'
import { type Opportunity, effectiveProbability, generateQuarters } from './OpportunitiesTable'

// ── Formatters ────────────────────────────────────────────────────────────────
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
function fmtFull(n: number) { return currencyFmt.format(n) }
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function quarterlyIncomes(o: Opportunity): Record<string, number> {
  return (o.quarterly_incomes as Record<string, number> | undefined) ?? {}
}

const STAGE_BADGE: Record<string, string> = {
  Discovery:   'bg-blue-100 text-blue-700',
  Proposal:    'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Win:         'bg-green-100 text-green-700',
}

function FilterSelect({
  label, value, onChange, placeholder, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
function ProjectionTab({
  opportunities,
  probabilityDefaults,
}: {
  opportunities: Opportunity[]
  probabilityDefaults?: Record<string, number>
}) {
  // The reporting horizon: current quarter + the following 7 (8 total),
  // matching the quarter inputs in the opportunity modal.
  const quarters = useMemo(() => generateQuarters(8), [])

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterText, setFilterText]       = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterStage, setFilterStage]     = useState('')

  const anyFilterActive = !!(filterText || filterManager || filterProduct || filterStage)

  function clearAllFilters() {
    setFilterText('')
    setFilterManager('')
    setFilterProduct('')
    setFilterStage('')
  }

  // Lost deals don't project income; Win deals keep projecting future income.
  const projectable = useMemo(
    () => opportunities.filter((o) => o.stage !== 'Loss'),
    [opportunities],
  )

  const managerOptions = useMemo(
    () => Array.from(new Set(projectable.map((o) => (o.owner as string) ?? '').filter(Boolean))).sort(),
    [projectable],
  )
  const productOptions = useMemo(
    () => Array.from(new Set(projectable.map((o) => (o.product as string) ?? '').filter(Boolean))).sort(),
    [projectable],
  )
  const stageOptions = ['Discovery', 'Proposal', 'Negotiation', 'Win']

  const filtered = useMemo(
    () => projectable.filter((o) => {
      if (filterText) {
        const q = filterText.trim().toLowerCase()
        const hit =
          (o.name ?? '').toLowerCase().includes(q) ||
          ((o.customer_name as string) ?? '').toLowerCase().includes(q) ||
          ((o.owner as string) ?? '').toLowerCase().includes(q) ||
          ((o.product as string) ?? '').toLowerCase().includes(q)
        if (!hit) return false
      }
      if (filterManager && (o.owner   as string)?.toLowerCase() !== filterManager.toLowerCase()) return false
      if (filterProduct && (o.product as string)?.toLowerCase() !== filterProduct.toLowerCase()) return false
      if (filterStage   && o.stage !== filterStage)                                              return false
      return true
    }),
    [projectable, filterText, filterManager, filterProduct, filterStage],
  )

  // ── Projection rows (filtered) ────────────────────────────────────────────
  const { rows, withoutBreakdown } = useMemo(() => {
    const rows = filtered
      .map((o) => {
        const qi  = quarterlyIncomes(o)
        const cur = o.currency as string | undefined
        const perQuarter = quarters.map((q) => toUSD(qi[q] ?? 0, cur))
        const total = perQuarter.reduce((s, v) => s + v, 0)
        const prob  = effectiveProbability(o, probabilityDefaults)
        return { opp: o, perQuarter, total, prob }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
    const withoutBreakdown = filtered.filter((o) => {
      const qi = quarterlyIncomes(o)
      return !quarters.some((q) => (qi[q] ?? 0) > 0)
    })
    return { rows, withoutBreakdown }
  }, [filtered, quarters, probabilityDefaults])

  const chartData = useMemo(
    () => quarters.map((q, i) => ({
      quarter:  q,
      Planned:  rows.reduce((s, r) => s + r.perQuarter[i], 0),
      Weighted: Math.round(rows.reduce((s, r) => s + (r.perQuarter[i] * r.prob) / 100, 0)),
    })),
    [quarters, rows],
  )

  // ── Per-manager quarterly summary ─────────────────────────────────────────
  const managerRows = useMemo(() => {
    const map: Record<string, { perQuarter: number[]; total: number; deals: number }> = {}
    rows.forEach((r) => {
      const name = (r.opp.owner as string) || 'Unassigned'
      if (!map[name]) map[name] = { perQuarter: quarters.map(() => 0), total: 0, deals: 0 }
      r.perQuarter.forEach((v, i) => { map[name].perQuarter[i] += v })
      map[name].total += r.total
      map[name].deals += 1
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
  }, [rows, quarters])

  const grandTotal    = rows.reduce((s, r) => s + r.total, 0)
  const weightedTotal = rows.reduce((s, r) => s + (r.total * r.prob) / 100, 0)
  const quarterTotals = quarters.map((_, i) => rows.reduce((s, r) => s + r.perQuarter[i], 0))

  // ── CSV report export ─────────────────────────────────────────────────────
  function exportProjectionCSV() {
    const headers = ['Opportunity', 'Account', 'Manager', 'Stage', 'Probability %', ...quarters, 'Total']
    const lines   = rows.map(({ opp, perQuarter, total, prob }) => [
      opp.name ?? '', (opp.customer_name as string) ?? '', (opp.owner as string) ?? '',
      opp.stage ?? '', prob, ...perQuarter.map((v) => Math.round(v)), Math.round(total),
    ])
    const totalsRow = ['Total', '', '', '', '', ...quarterTotals.map((v) => Math.round(v)), Math.round(grandTotal)]
    const csv  = [headers, ...lines, totalsRow]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sales-projection-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Sales Projection — Next 8 Quarters</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Planned income per quarter, from the &quot;Planned Income by Quarter&quot; breakdown on each opportunity.
            Lost deals are excluded. Print (header button) or export CSV for a report.
          </p>
        </div>
        <button
          onClick={exportProjectionCSV}
          disabled={rows.length === 0}
          className="no-print flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report (CSV)
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="no-print flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search opportunity, account…"
          className="w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
        />
        <FilterSelect label="Manager" value={filterManager} onChange={setFilterManager} placeholder="All Managers" options={managerOptions} />
        <FilterSelect label="Product" value={filterProduct} onChange={setFilterProduct} placeholder="All Products" options={productOptions} />
        <FilterSelect label="Stage"   value={filterStage}   onChange={setFilterStage}   placeholder="All Stages"   options={stageOptions} />
        {anyFilterActive && (
          <span className="flex items-center gap-3 text-xs text-gray-400">
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 font-semibold text-gray-500 shadow-sm">
              {rows.length} deal{rows.length !== 1 ? 's' : ''}
            </span>
            <button onClick={clearAllFilters} className="transition-colors hover:text-gray-700">Clear all</button>
          </span>
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm border-t-4 border-blue-500">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Total Planned</p>
          <p className="tabular-nums text-3xl font-bold leading-none text-slate-900">{fmtFull(grandTotal)}</p>
          <p className="mt-2 text-xs text-gray-400">over the next 8 quarters{anyFilterActive ? ' (filtered)' : ''}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm border-t-4 border-indigo-500">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Weighted Planned</p>
          <p className="tabular-nums text-3xl font-bold leading-none text-indigo-600">{fmtFull(weightedTotal)}</p>
          <p className="mt-2 text-xs text-gray-400">adjusted by win probability</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm border-t-4 border-emerald-500">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Deals in Projection</p>
          <p className="tabular-nums text-3xl font-bold leading-none text-slate-900">{rows.length}</p>
          <p className="mt-2 text-xs text-gray-400">
            {withoutBreakdown.length > 0
              ? `${withoutBreakdown.length} deal${withoutBreakdown.length !== 1 ? 's' : ''} without a quarterly breakdown`
              : 'all open deals have a breakdown'}
          </p>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Projected Income per Quarter</h3>
        <p className="mb-4 mt-0.5 text-xs text-gray-400">
          Planned = sum of quarterly allocations · Weighted = adjusted by each deal&apos;s probability
        </p>
        {grandTotal === 0 ? (
          <EmptyState filtered={anyFilterActive} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="Planned"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Weighted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Per-manager summary ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Projection by Sales Manager</h3>
        <p className="mb-4 mt-0.5 text-xs text-gray-400">Planned income per manager per quarter (USD)</p>
        {managerRows.length === 0 ? (
          <EmptyState filtered={anyFilterActive} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Manager</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Deals</th>
                  {quarters.map((q) => (
                    <th key={q} className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{q}</th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {managerRows.map((m) => (
                  <tr key={m.name} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-gray-900">{m.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-500">{m.deals}</td>
                    {m.perQuarter.map((v, i) => (
                      <td key={i} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${v > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {v > 0 ? fmtShort(v) : '—'}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-indigo-600">{fmtShort(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500" colSpan={2}>Total</td>
                  {quarterTotals.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-gray-900">
                      {v > 0 ? fmtShort(v) : '—'}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-indigo-700">{fmtShort(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Report table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Projection Report</h3>
        <p className="mb-4 mt-0.5 text-xs text-gray-400">Planned income per opportunity per quarter (USD)</p>
        {rows.length === 0 ? (
          <EmptyState filtered={anyFilterActive} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Opportunity</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Manager</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stage</th>
                  {quarters.map((q) => (
                    <th key={q} className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{q}</th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map(({ opp, perQuarter, total }) => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="max-w-[220px] px-4 py-2.5">
                      <p className="truncate font-medium text-gray-900">{opp.name ?? '—'}</p>
                      <p className="truncate text-xs text-gray-400">{(opp.customer_name as string) ?? ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{(opp.owner as string) ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[opp.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {opp.stage ?? '—'}
                      </span>
                    </td>
                    {perQuarter.map((v, i) => (
                      <td key={i} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${v > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {v > 0 ? fmtShort(v) : '—'}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-indigo-600">{fmtShort(total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500" colSpan={3}>Total</td>
                  {quarterTotals.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-gray-900">
                      {v > 0 ? fmtShort(v) : '—'}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-indigo-700">{fmtShort(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {withoutBreakdown.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700">
              Not in this projection — no quarterly breakdown yet:
            </p>
            <p className="mt-1 text-xs text-amber-600">
              {withoutBreakdown.map((o) => o.name).filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-amber-500">
              Open a deal from the Pipeline tab and fill in &quot;Planned Income by Quarter&quot; to include it.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}

// memo: Dashboard re-renders on unrelated state changes (modals, dropdowns);
// projection math only needs to rerun when the opportunities actually change.
export default memo(ProjectionTab)

function EmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
      <p className="text-sm text-gray-400">
        {filtered ? 'No deals match the current filters.' : 'No planned income entered yet.'}
      </p>
      <p className="mt-1 text-xs text-gray-300">
        {filtered
          ? 'Adjust or clear the filters above.'
          : 'Open an opportunity in the Pipeline tab and fill in "Planned Income by Quarter".'}
      </p>
    </div>
  )
}

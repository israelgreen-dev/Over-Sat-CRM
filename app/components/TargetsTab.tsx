'use client'

import { useState } from 'react'
import { NumericInput } from './OpportunitiesTable'

export type QuarterlyData = { q1: number; q2: number; q3: number; q4: number }

export type ProductTargetRow = {
  id: string
  product: string
  price: number
  quantity: number
  probability: number
  description?: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const QUARTERS: (keyof QuarterlyData)[] = ['q1', 'q2', 'q3', 'q4']
const Q_LABELS = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4' }

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-center font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'
const qInputCls =
  'w-full rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-sm text-center font-medium text-gray-900 focus:border-amber-400 focus:bg-white focus:outline-none transition-colors'

function newRow(): ProductTargetRow {
  return { id: Math.random().toString(36).slice(2), product: '', price: 0, quantity: 1, probability: 100, description: '' }
}

function computeWeighted(rows: ProductTargetRow[]) {
  return rows.reduce((s, r) => s + r.price * r.quantity * (r.probability / 100), 0)
}

export default function TargetsTab({
  managers,
  managerTargets,
  onManagerTargetsChange,
  quarterlyTargets,
  onQuarterlyTargetsChange,
  selectedYear,
  availableYears,
  onCopyTargetsToYear,
  products,
  productTargetRowsByManager,
  onProductTargetRowsByManagerChange,
  readOnly = false,
}: {
  managers: string[]
  managerTargets: Record<string, number>
  onManagerTargetsChange: (v: Record<string, number>) => void
  quarterlyTargets: Record<string, QuarterlyData>
  onQuarterlyTargetsChange: (v: Record<string, QuarterlyData>) => void
  selectedYear: string
  availableYears: string[]
  onCopyTargetsToYear: (toYear: string) => void
  products: string[]
  productTargetRowsByManager: Record<string, ProductTargetRow[]>
  onProductTargetRowsByManagerChange: (v: Record<string, ProductTargetRow[]>) => void
  readOnly?: boolean
}) {
  const [copyTo, setCopyTo] = useState('')

  const otherYears = availableYears.filter((y) => y !== selectedYear)

  // When product rows change for a manager, sync the annual target so other
  // components (banner, analytics, manager cards) see the updated number.
  function handleManagerRows(name: string, newRows: ProductTargetRow[]) {
    const updatedByManager = { ...productTargetRowsByManager, [name]: newRows }
    onProductTargetRowsByManagerChange(updatedByManager)
    const newTarget = Math.round(computeWeighted(newRows))
    onManagerTargetsChange({ ...managerTargets, [name]: newTarget })
  }

  function updateRow(name: string, id: string, field: keyof ProductTargetRow, value: string | number) {
    const rows = productTargetRowsByManager[name] ?? []
    handleManagerRows(name, rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  function addRow(name: string) {
    handleManagerRows(name, [...(productTargetRowsByManager[name] ?? []), newRow()])
  }

  function deleteRow(name: string, id: string) {
    handleManagerRows(name, (productTargetRowsByManager[name] ?? []).filter((r) => r.id !== id))
  }

  function handleQuarter(name: string, q: keyof QuarterlyData, v: number | null) {
    const cur = quarterlyTargets[name] ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
    onQuarterlyTargetsChange({ ...quarterlyTargets, [name]: { ...cur, [q]: v ?? 0 } })
  }


  // Totals across all managers
  const overallTarget = managers.reduce((s, name) => {
    return s + Math.round(computeWeighted(productTargetRowsByManager[name] ?? []))
  }, 0)

  const overallQ = managers.reduce(
    (acc, name) => {
      const q = quarterlyTargets[name] ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
      return { q1: acc.q1 + q.q1, q2: acc.q2 + q.q2, q3: acc.q3 + q.q3, q4: acc.q4 + q.q4 }
    },
    { q1: 0, q2: 0, q3: 0, q4: 0 },
  )

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Targets — {selectedYear}</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Overall Target: <span className="font-semibold text-gray-700">{fmt(overallTarget)}</span>
            &nbsp;·&nbsp; Each manager's target is derived from their product forecast.
          </p>
        </div>
        {otherYears.length > 0 && !readOnly && (
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-700 focus:outline-none"
              value={copyTo}
              onChange={(e) => setCopyTo(e.target.value)}
            >
              <option value="">Copy to year…</option>
              {otherYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              disabled={!copyTo}
              onClick={() => { if (copyTo) { onCopyTargetsToYear(copyTo); setCopyTo('') } }}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              Copy
            </button>
          </div>
        )}
        {readOnly && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">View only</span>
        )}
      </div>

      {/* ── Per-manager cards ─────────────────────────────────────────────────── */}
      {managers.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm">
          Add managers in Settings to set targets.
        </div>
      )}

      {managers.map((name) => {
        const rows        = productTargetRowsByManager[name] ?? []
        const annualTarget = Math.round(computeWeighted(rows))
        const totalPrice  = rows.reduce((s, r) => s + r.price * r.quantity, 0)
        const qt          = quarterlyTargets[name] ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
        const qSum        = QUARTERS.reduce((s, q) => s + qt[q], 0)

        return (
          <div key={name} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">

            {/* Manager header */}
            <div className="flex items-center gap-4 border-b border-gray-100 bg-slate-50 px-5 py-3">
              <span className="font-bold text-gray-900">{name}</span>
              <span className="text-sm text-gray-400">
                Annual Target:{' '}
                <span className="font-semibold text-gray-700">{fmt(annualTarget)}</span>
              </span>
            </div>

            {/* Product forecast table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-white">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 min-w-[150px]">Product</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 min-w-[180px]">Description</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[120px]">Unit Price ($)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[72px]">Qty</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-blue-500 min-w-[110px]">Total Price ($)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-purple-500 min-w-[110px]">Probability</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-emerald-600 min-w-[120px]">Weighted Price ($)</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, idx) => {
                    const tp = row.price * row.quantity
                    const wp = tp * (row.probability / 100)
                    return (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className="px-4 py-2">
                          {readOnly
                            ? <span className="text-sm text-gray-700">{row.product || '—'}</span>
                            : <select
                                value={row.product}
                                onChange={(e) => updateRow(name, row.id, 'product', e.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
                              >
                                <option value="">Select product…</option>
                                {products.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                          }
                        </td>
                        <td className="px-3 py-2">
                          {readOnly
                            ? <span className="text-sm text-gray-600">{row.description || '—'}</span>
                            : <input
                                type="text"
                                value={row.description ?? ''}
                                onChange={(e) => updateRow(name, row.id, 'description', e.target.value)}
                                placeholder="Add a note…"
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
                              />
                          }
                        </td>
                        <td className="px-3 py-2">
                          {readOnly
                            ? <span className="block text-center text-sm font-medium text-gray-700">{fmtShort(row.price)}</span>
                            : <NumericInput className={inputCls} value={row.price} onChange={(v) => updateRow(name, row.id, 'price', v ?? 0)} />
                          }
                        </td>
                        <td className="px-3 py-2">
                          {readOnly
                            ? <span className="block text-center text-sm font-medium text-gray-700">{row.quantity}</span>
                            : <NumericInput className={inputCls} value={row.quantity} onChange={(v) => updateRow(name, row.id, 'quantity', Math.max(1, v ?? 1))} />
                          }
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-blue-600">{fmtShort(tp)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {readOnly
                              ? <span className="block w-full text-center text-sm font-medium text-gray-700">{row.probability}%</span>
                              : <>
                                  <NumericInput className={inputCls} value={row.probability} onChange={(v) => updateRow(name, row.id, 'probability', Math.min(100, Math.max(0, v ?? 0)))} />
                                  <span className="text-xs text-gray-400 shrink-0">%</span>
                                </>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600">{fmtShort(wp)}</td>
                        <td className="px-2 py-2 text-center">
                          {!readOnly && (
                            <button
                              onClick={() => deleteRow(name, row.id)}
                              title="Remove row"
                              className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-5 text-center text-xs text-gray-400">
                        No products yet — click "+ Add Product" below.
                      </td>
                    </tr>
                  )}

                  {rows.length > 0 && (
                    <tr className="border-t-2 border-gray-100 bg-slate-50 font-bold">
                      <td className="px-4 py-2.5 text-xs uppercase tracking-wider text-gray-400" colSpan={4}>Total</td>
                      <td className="px-3 py-2.5 text-center text-blue-600">{fmt(totalPrice)}</td>
                      <td />
                      <td className="px-3 py-2.5 text-center text-emerald-700">{fmt(annualTarget)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add product row */}
            {!readOnly && <div className="border-t border-gray-50 px-4 py-2">
              <button
                onClick={() => addRow(name)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-orange-500 hover:bg-orange-50 transition-colors"
              >
                + Add Product
              </button>
            </div>}

            {/* Quarterly split */}
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-amber-50/40">
                    <th className="px-3 py-2 min-w-[140px]" />
                    {QUARTERS.map((q) => (
                      <th key={q} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-500 min-w-[110px]">
                        {Q_LABELS[q]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    {/* Small split button aligned right in its cell */}
                    <td className="px-3 py-2 text-right">
                      {!readOnly && (
                        <button
                          onClick={() => {
                            const q = Math.round(annualTarget / 4)
                            onQuarterlyTargetsChange({ ...quarterlyTargets, [name]: { q1: q, q2: q, q3: q, q4: q } })
                          }}
                          disabled={annualTarget === 0}
                          title={`Split ${fmt(annualTarget)} equally across Q1–Q4`}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
                          </svg>
                          Split ÷ 4
                        </button>
                      )}
                    </td>
                    {QUARTERS.map((q) => (
                      <td key={q} className="px-3 py-2 w-28">
                        {readOnly
                          ? <span className="block text-center text-sm font-semibold text-amber-700">{fmtShort(qt[q])}</span>
                          : <NumericInput className={qInputCls} value={qt[q]} onChange={(v) => handleQuarter(name, q, v)} />
                        }
                      </td>
                    ))}
                  </tr>
                  {annualTarget > 0 && (() => {
                    const isMatch = qSum === annualTarget
                    const pct = Math.min(100, annualTarget > 0 ? (qSum / annualTarget) * 100 : 0)
                    const isOver = qSum > annualTarget
                    return (
                      <tr className="bg-white">
                        {/* Empty cell under the button */}
                        <td className="px-3 pb-3" />
                        {/* Indicator spans only the 4 quarter columns */}
                        <td colSpan={4} className="px-3 pb-3 pt-1">
                          <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isMatch ? 'bg-emerald-400' : isOver ? 'bg-red-400' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isMatch ? (
                              <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                            )}
                            <span className={`text-xs font-semibold ${isMatch ? 'text-emerald-700' : isOver ? 'text-red-700' : 'text-amber-700'}`}>
                              {isMatch
                                ? `${fmtShort(qSum)} allocated — all set`
                                : isOver
                                  ? `${fmtShort(qSum)} allocated — ${fmtShort(qSum - annualTarget)} over target`
                                  : `${fmtShort(qSum)} of ${fmtShort(annualTarget)} — ${fmtShort(annualTarget - qSum)} unallocated`}
                            </span>
                            <span className={`ml-auto text-xs font-bold ${isMatch ? 'text-emerald-600' : isOver ? 'text-red-600' : 'text-amber-600'}`}>
                              {Math.round(pct)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>

          </div>
        )
      })}

      {/* ── Company totals ────────────────────────────────────────────────────── */}
      {managers.length > 1 && (
        <div className="rounded-2xl border border-gray-200 bg-slate-50 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 min-w-[120px]">Company Total</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Annual</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-amber-500">{Q_LABELS[q]} Target</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold">
                <td className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">All Managers</td>
                <td className="px-3 py-3 text-center text-gray-900">{fmtShort(overallTarget)}</td>
                {QUARTERS.map((q) => (
                  <td key={q} className="px-3 py-3 text-center text-amber-600">{fmtShort(overallQ[q])}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {managers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" /> Total Price — unit price × qty</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Weighted Price — total × probability %</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Q1–Q4 — quarterly quota (editable or split ÷ 4)</span>
        </div>
      )}

    </div>
  )
}

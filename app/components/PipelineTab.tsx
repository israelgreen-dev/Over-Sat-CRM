'use client'

import { useState, useRef } from 'react'
import { type Opportunity, Modal, AddOpportunityModal, effectiveProbability, weightedValue, getProductLines } from './OpportunitiesTable'
import { fmtUSD } from '@/lib/currency'
import { supabase } from '@/lib/supabase'

const STAGE_COLORS: Record<string, string> = {
  Discovery:   'bg-blue-100 text-blue-700',
  Proposal:    'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Win:         'bg-green-100 text-green-700',
  Loss:        'bg-red-100 text-red-700',
}

// Days an open deal has been sitting in its current stage (migration 009
// tracks stage_changed_at; older rows fall back to created_at).
function daysInStage(o: Opportunity): number | null {
  if (['Win', 'Loss'].includes(o.stage)) return null
  const ts = (o as any).stage_changed_at ?? (o as any).created_at
  if (!ts) return null
  const d = new Date(String(ts))
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}
const STALE_DAYS = 60

// An open deal whose expected close quarter ("Qn-YYYY") has already passed.
function isOverdue(o: Opportunity): boolean {
  if (['Win', 'Loss'].includes(o.stage)) return false
  const m = String((o as any).close_date ?? '').match(/Q([1-4])-(\d{4})/)
  if (!m) return false
  const now = new Date()
  const nowKey = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3) + 1
  return Number(m[2]) * 4 + Number(m[1]) < nowKey
}

type SortDir = 'asc' | 'desc'

const COLUMNS: { label: string; field: string; numeric?: boolean }[] = [
  { label: 'Opportunity',    field: 'name' },
  { label: 'Account',        field: 'customer_name' },
  { label: 'Sales Manager',  field: 'owner' },
  { label: 'Product',        field: 'product' },
  { label: 'Value',          field: 'value',       numeric: true },
  { label: 'Prob %',         field: 'probability', numeric: true },
  { label: 'Weighted Value', field: '_weighted',   numeric: true },
  { label: 'Stage',          field: 'stage' },
  { label: 'Close Date',     field: 'close_date' },
  { label: 'Status',         field: 'status' },
  { label: 'Updated',        field: 'updated_at' },
]

// Compact display for the Updated column ("12 Jun 25").
const updatedFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
function fmtUpdated(ts: unknown): string {
  if (!ts) return '—'
  const d = new Date(String(ts))
  return Number.isNaN(d.getTime()) ? '—' : updatedFmt.format(d)
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

function sortRows(rows: Opportunity[], key: string, dir: SortDir, numeric: boolean): Opportunity[] {
  return [...rows].sort((a, b) => {
    const av = (a as any)[key]
    const bv = (b as any)[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = numeric
      ? Number(av) - Number(bv)
      : String(av).toLowerCase().localeCompare(String(bv).toLowerCase())
    return dir === 'asc' ? cmp : -cmp
  })
}

export default function PipelineTab({
  opportunities,
  addFormOpen = false,
  onAddFormOpenChange,
  products,
  managers,
  managerColors = {},
  defaultOwner = '',
  canDelete,
  probabilityDefaults,
  onOppUpdated,
  onOppAdded,
  onOppDeleted,
}: {
  opportunities: Opportunity[]
  addFormOpen?: boolean
  onAddFormOpenChange?: (v: boolean) => void
  products?: string[]
  managers?: string[]
  managerColors?: Record<string, string>
  defaultOwner?: string
  canDelete?: boolean
  probabilityDefaults?: Record<string, number>
  onOppUpdated?: (updated: Opportunity) => void
  onOppAdded?: (newOpp: Opportunity) => void
  onOppDeleted?: (id: string | number) => void
}) {
  const [selected, setSelected]               = useState<Opportunity | null>(null)
  const [filterText, setFilterText]           = useState<string>('')
  const [filterManager, setFilterManager]     = useState<string>('')
  const [filterProduct, setFilterProduct]     = useState<string>('')
  const [filterStage, setFilterStage]         = useState<string>('')
  const [filterStatus, setFilterStatus]       = useState<string>('')
  const [sortKey, setSortKey]                 = useState<string>('')
  const [sortDir, setSortDir]                 = useState<SortDir>('asc')
  const [deletingId, setDeletingId]           = useState<string | number | null>(null)
  const searchRef                             = useRef<HTMLInputElement>(null)

  // Include every product configured in Settings plus any ad-hoc products
  // present on existing opportunities — so the shortcuts/dropdown aren't
  // limited to products that already appear on a deal. Settings order is
  // preserved (no alphabetical sort), with ad-hoc products appended after.
  const productOptions = Array.from(new Set([
    ...(products ?? []),
    ...opportunities.flatMap((r) => getProductLines(r).map((l) => l.product)).filter(Boolean),
  ]))
  const stageOptions   = Object.keys(STAGE_COLORS)
  const statusOptions  = Array.from(new Set(opportunities.map((r) => (r as any).status ?? '').filter(Boolean))).sort()

  const anyFilterActive = !!(filterText || filterManager || filterProduct || filterStage || filterStatus)

  function clearAllFilters() {
    setFilterText('')
    setFilterManager('')
    setFilterProduct('')
    setFilterStage('')
    setFilterStatus('')
  }

  function handleSort(field: string) {
    if (sortKey === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(field)
      setSortDir('asc')
    }
  }

  // ── Build the displayed row list ──────────────────────────────────────────
  let displayedRows = opportunities.filter((r) => {
    if (filterText) {
      const q = filterText.trim().toLowerCase()
      const hit =
        (r.name            ?? '').toLowerCase().includes(q) ||
        ((r.customer_name  as string) ?? '').toLowerCase().includes(q) ||
        ((r.owner          as string) ?? '').toLowerCase().includes(q) ||
        ((r.product        as string) ?? '').toLowerCase().includes(q)
      if (!hit) return false
    }
    if (filterManager && (r.owner   as string)?.toLowerCase() !== filterManager.toLowerCase()) return false
    if (filterProduct && !getProductLines(r).some((l) => l.product.toLowerCase() === filterProduct.toLowerCase())) return false
    if (filterStage   && r.stage?.toLowerCase() !== filterStage.toLowerCase())                 return false
    if (filterStatus  && ((r as any).status ?? '')?.toLowerCase() !== filterStatus.toLowerCase()) return false
    return true
  })

  if (sortKey) {
    const col = COLUMNS.find((c) => c.field === sortKey)
    displayedRows = sortRows(displayedRows, sortKey, sortDir, col?.numeric ?? false)
  }

  function handleSaved(updated: Opportunity) {
    setSelected(updated)
    onOppUpdated?.(updated)
  }

  function handleAdded(newOpp: Opportunity) {
    onOppAdded?.(newOpp)
  }

  function handleAddedThenUpdated(updated: Opportunity) {
    onOppUpdated?.(updated)
  }

  function handleDeleted(id: string | number) {
    setSelected(null)
    onOppDeleted?.(id)
  }

  // Quick delete straight from a table row (confirm → Supabase → live update).
  // stopPropagation keeps the row click from also opening the detail modal.
  async function handleRowDelete(e: React.MouseEvent, opp: Opportunity) {
    e.stopPropagation()
    if (deletingId != null) return
    if (!confirm(`Permanently delete "${opp.name || 'this opportunity'}"? This cannot be undone.`)) return
    setDeletingId(opp.id)
    const { error } = await supabase.from('opportunities').delete().eq('id', opp.id)
    setDeletingId(null)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    if (selected?.id === opp.id) setSelected(null)
    onOppDeleted?.(opp.id)
  }

  return (
    <>
      {/* ── Manager shortcut buttons ─────────────────────────────────────── */}
      {managers && managers.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quick filter:</span>
          <button
            onClick={() => setFilterManager('')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filterManager === ''
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {managers.map((name) => {
            const color  = managerColors[name] ?? '#94a3b8'
            const active = filterManager === name
            return (
              <button
                key={name}
                onClick={() => setFilterManager(active ? '' : name)}
                style={{
                  backgroundColor: active ? color : `${color}22`,
                  color:           active ? '#fff' : color,
                  borderColor:     color,
                }}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:opacity-90"
              >
                {name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Product shortcut buttons ─────────────────────────────────────── */}
      {productOptions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product:</span>
          <button
            onClick={() => setFilterProduct('')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filterProduct === ''
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {productOptions.map((name) => (
            <button
              key={name}
              onClick={() => setFilterProduct(filterProduct === name ? '' : name)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filterProduct === name
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          {/* Search icon */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            ref={searchRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search by opportunity, account, manager or product…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />

          {/* Clear button — only visible when there is text */}
          {filterText && (
            <button
              onClick={() => { setFilterText(''); searchRef.current?.focus() }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-700"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Result count — shown whenever any filter (text or dropdown) is active */}
        {anyFilterActive && (
          <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
            {displayedRows.length} / {opportunities.length}
          </span>
        )}
      </div>

      {/* ── Dropdown filters ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-6">
        {managers && managers.length > 0 && (
          <FilterSelect
            label="Sales Manager"
            value={filterManager}
            onChange={setFilterManager}
            placeholder="All Managers"
            options={managers}
          />
        )}
        <FilterSelect
          label="Product"
          value={filterProduct}
          onChange={setFilterProduct}
          placeholder="All Products"
          options={productOptions}
        />
        <FilterSelect
          label="Stage"
          value={filterStage}
          onChange={setFilterStage}
          placeholder="All Stages"
          options={stageOptions}
        />
        <FilterSelect
          label="Status"
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="All Statuses"
          options={statusOptions}
        />
        {anyFilterActive && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-400 transition-colors hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(({ label, field, numeric }) => {
                const active = sortKey === field
                return (
                  <th
                    key={label}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    <button
                      onClick={() => handleSort(field)}
                      className="inline-flex items-center gap-1 transition-colors hover:text-gray-800"
                    >
                      {label}
                      <span className="flex flex-col leading-none text-[9px]">
                        <span className={active && sortDir === 'asc'  ? 'text-blue-500' : 'text-gray-300'}>▲</span>
                        <span className={active && sortDir === 'desc' ? 'text-blue-500' : 'text-gray-300'}>▼</span>
                      </span>
                    </button>
                  </th>
                )
              })}
              {canDelete && (
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + (canDelete ? 1 : 0)} className="px-4 py-12 text-center">
                  {anyFilterActive ? (
                    <div>
                      <p className="text-sm font-medium text-gray-500">No results for &quot;{filterText || [filterManager, filterProduct, filterStage, filterStatus].filter(Boolean).join(', ')}&quot;</p>
                      <button
                        onClick={clearAllFilters}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-500">No opportunities yet.</p>
                      <p className="mt-1 text-xs text-gray-400">Click the orange <span className="font-semibold text-orange-500">+ New</span> button in the top bar to add your first deal.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayedRows.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => setSelected(opp)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  {/* Opportunity name */}
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium text-gray-900">
                    {opp.name ?? '—'}
                  </td>
                  {/* Account */}
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {(opp.customer_name as string) ?? '—'}
                  </td>
                  {/* Sales Manager */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp.owner as string) ?? '—'}
                  </td>
                  {/* Product */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp.product as string) ?? '—'}
                  </td>
                  {/* Value */}
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-gray-900">
                    {opp.value != null ? fmtUSD(opp.value, (opp as any).currency) : '—'}
                  </td>
                  {/* Probability */}
                  <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-blue-600 font-medium">
                    {effectiveProbability(opp, probabilityDefaults)}%
                    {(opp as any).probability == null && (
                      <span className="ml-1 text-[10px] text-gray-400">(def)</span>
                    )}
                  </td>
                  {/* Weighted Value */}
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-indigo-600">
                    {opp.value != null ? fmtUSD(weightedValue(opp, probabilityDefaults), (opp as any).currency) : '—'}
                  </td>
                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STAGE_COLORS[opp.stage] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {opp.stage ?? '—'}
                    </span>
                    {(() => {
                      const days = daysInStage(opp)
                      if (days == null || days < STALE_DAYS) return null
                      return (
                        <span
                          className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"
                          title={`${days} days in ${opp.stage} — consider following up or updating the stage`}
                        >
                          Stale
                        </span>
                      )
                    })()}
                  </td>
                  {/* Close Date */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).close_date ?? '—'}
                    {isOverdue(opp) && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600" title="Expected close quarter has passed — update the close date or the stage">
                        Overdue
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).status ?? '—'}
                  </td>
                  {/* Last updated (falls back to created date for old rows) */}
                  <td
                    className="whitespace-nowrap px-4 py-3 text-xs text-gray-400"
                    title={(opp as any).updated_at ? `Last updated ${new Date(String((opp as any).updated_at)).toLocaleString()}` : undefined}
                  >
                    {fmtUpdated((opp as any).updated_at ?? (opp as any).created_at)}
                  </td>
                  {/* Actions — delete */}
                  {canDelete && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={(e) => handleRowDelete(e, opp)}
                        disabled={deletingId === opp.id}
                        title="Delete opportunity"
                        aria-label={`Delete ${opp.name ?? 'opportunity'}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === opp.id ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal
          opportunity={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onDeleted={() => handleDeleted(selected.id)}
          canDelete={canDelete}
          products={products}
          managers={managers}
          probabilityDefaults={probabilityDefaults}
        />
      )}

      {addFormOpen && (
        <AddOpportunityModal
          products={products}
          managers={managers}
          existingAccounts={opportunities.map((o) => (o.customer_name as string) ?? '')}
          defaultOwner={defaultOwner}
          probabilityDefaults={probabilityDefaults}
          onClose={() => onAddFormOpenChange?.(false)}
          onAdded={handleAdded}
          onUpdated={handleAddedThenUpdated}
        />
      )}
    </>
  )
}

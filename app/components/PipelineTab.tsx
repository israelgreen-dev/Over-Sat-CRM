'use client'

import { useState, useRef } from 'react'
import { type Opportunity, Modal, AddOpportunityModal } from './OpportunitiesTable'
import { fmtUSD } from '@/lib/currency'

const STAGE_COLORS: Record<string, string> = {
  Discovery:   'bg-blue-100 text-blue-700',
  Proposal:    'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Win:         'bg-green-100 text-green-700',
  Loss:        'bg-red-100 text-red-700',
}


type SortDir = 'asc' | 'desc'

const COLUMNS: { label: string; field: string; numeric?: boolean }[] = [
  { label: 'Opportunity',    field: 'name' },
  { label: 'Account',        field: 'customer_name' },
  { label: 'Sales Manager',  field: 'owner' },
  { label: 'Product',        field: 'product' },
  { label: 'Value',          field: 'value',       numeric: true },
  { label: 'Stage',          field: 'stage' },
  { label: 'Close Date',     field: 'close_date' },
  { label: 'Status',         field: 'status' },
]

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
  defaultOwner = '',
  isAdmin,
  onOppUpdated,
  onOppAdded,
  onOppDeleted,
}: {
  opportunities: Opportunity[]
  addFormOpen?: boolean
  onAddFormOpenChange?: (v: boolean) => void
  products?: string[]
  managers?: string[]
  defaultOwner?: string
  isAdmin?: boolean
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
  const searchRef                             = useRef<HTMLInputElement>(null)

  const productOptions = Array.from(new Set(opportunities.map((r) => (r.product as string) ?? '').filter(Boolean))).sort()
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

  function handleSort(field: string, numeric: boolean) {
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
    if (filterProduct && (r.product as string)?.toLowerCase() !== filterProduct.toLowerCase()) return false
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

  return (
    <>
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
                      onClick={() => handleSort(field, numeric ?? false)}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center">
                  {anyFilterActive ? (
                    <div>
                      <p className="text-sm font-medium text-gray-500">No results for "{filterText || [filterManager, filterProduct, filterStage, filterStatus].filter(Boolean).join(', ')}"</p>
                      <button
                        onClick={clearAllFilters}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-400">No opportunities found.</p>
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
                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STAGE_COLORS[opp.stage] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {opp.stage ?? '—'}
                    </span>
                  </td>
                  {/* Close Date */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).close_date ?? '—'}
                  </td>
                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).status ?? '—'}
                  </td>
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
          isAdmin={isAdmin}
          products={products}
          managers={managers}
        />
      )}

      {addFormOpen && (
        <AddOpportunityModal
          products={products}
          managers={managers}
          defaultOwner={defaultOwner}
          onClose={() => onAddFormOpenChange?.(false)}
          onAdded={handleAdded}
          onUpdated={handleAddedThenUpdated}
        />
      )}
    </>
  )
}

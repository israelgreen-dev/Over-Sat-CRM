'use client'

import { useState } from 'react'
import { NumericInput } from './OpportunitiesTable'

export default function SettingsTab({
  managers,
  products,
  headOfSales,
  partners,
  onManagersChange,
  onProductsChange,
  onHeadOfSalesChange,
  onPartnersChange,
  managerTargets,
  onManagerTargetsChange,
  selectedYear,
  availableYears,
  onCopyTargetsToYear,
}: {
  managers: string[]
  products: string[]
  headOfSales: string
  partners: string[]
  onManagersChange: (v: string[]) => void
  onProductsChange: (v: string[]) => void
  onHeadOfSalesChange: (v: string) => void
  onPartnersChange: (v: string[]) => void
  managerTargets: Record<string, number>
  onManagerTargetsChange: (v: Record<string, number>) => void
  selectedYear: string
  availableYears: string[]
  onCopyTargetsToYear: (toYear: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-gray-900">Settings</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          Manage dropdown values and targets. Changes apply immediately.
        </p>
      </div>

      {/* ── Head of Sales ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          <h3 className="text-sm font-bold text-gray-900">Head of Sales</h3>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          This manager sees all pipeline data and aggregated analytics across every rep.
        </p>
        <select
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
          value={headOfSales}
          onChange={(e) => onHeadOfSalesChange(e.target.value)}
        >
          {managers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* ── Targets ────────────────────────────────────────────────────────── */}
      <TargetsEditor
        managers={managers}
        managerTargets={managerTargets}
        onManagerTargetsChange={onManagerTargetsChange}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onCopyTargetsToYear={onCopyTargetsToYear}
      />

      {/* ── Lists ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListEditor
          title="Sales Managers"
          description="Names available in the Owner field on all opportunities."
          items={managers}
          onChange={onManagersChange}
          placeholder="e.g. David"
          accent="#3b82f6"
        />
        <ListEditor
          title="Products"
          description="Values shown in the Product dropdown on opportunity forms."
          items={products}
          onChange={onProductsChange}
          placeholder="e.g. Falcon9"
          accent="#8b5cf6"
        />
        <ListEditor
          title="Partners"
          description="Partners can view all pipeline data and analytics but cannot access Settings."
          items={partners}
          onChange={onPartnersChange}
          placeholder="e.g. Acme Corp"
          accent="#10b981"
        />
      </div>
    </div>
  )
}

function TargetsEditor({
  managers,
  managerTargets,
  onManagerTargetsChange,
  selectedYear,
  availableYears,
  onCopyTargetsToYear,
}: {
  managers: string[]
  managerTargets: Record<string, number>
  onManagerTargetsChange: (v: Record<string, number>) => void
  selectedYear: string
  availableYears: string[]
  onCopyTargetsToYear: (toYear: string) => void
}) {
  const [copyTo, setCopyTo] = useState('')
  const overallTarget = Object.values(managerTargets).reduce((s, v) => s + v, 0)
  const otherYears = availableYears.filter((y) => y !== selectedYear)

  function handleManager(name: string, n: number | null) {
    onManagerTargetsChange({ ...managerTargets, [name]: n ?? 0 })
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <h3 className="text-sm font-bold text-gray-900">Targets (USD) — {selectedYear}</h3>
        </div>
        {otherYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Copy to</span>
            <select
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 focus:outline-none"
              value={copyTo}
              onChange={(e) => setCopyTo(e.target.value)}
            >
              <option value="">Select year…</option>
              {otherYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              disabled={!copyTo}
              onClick={() => { if (copyTo) { onCopyTargetsToYear(copyTo); setCopyTo('') } }}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-40"
            >
              Copy
            </button>
          </div>
        )}
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Set annual quotas for {selectedYear}. Use Copy to duplicate them to another year.
      </p>

      {/* Overall target — derived from sum of manager quotas */}
      <div className="mb-5">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Overall Target
        </label>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-sm font-medium text-gray-900">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(overallTarget)}
          </span>
          <span className="text-xs text-gray-400">Auto — sum of manager quotas</span>
        </div>
      </div>

      {/* Per-manager targets */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Per-Manager Quotas
      </p>
      <div className="space-y-2">
        {managers.map((name) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-medium text-gray-700">{name}</span>
            <NumericInput
              className={inputCls}
              value={managerTargets[name] ?? 0}
              onChange={(v) => handleManager(name, v)}
            />
          </div>
        ))}
        {managers.length === 0 && (
          <p className="text-xs text-gray-400">Add managers first to set individual quotas.</p>
        )}
      </div>
    </div>
  )
}

function ListEditor({
  title,
  description,
  items,
  onChange,
  placeholder,
  accent,
}: {
  title: string
  description: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
  accent: string
}) {
  const [newItem, setNewItem]     = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingVal, setEditingVal] = useState('')

  function add() {
    const val = newItem.trim()
    if (!val || items.map((i) => i.toLowerCase()).includes(val.toLowerCase())) return
    onChange([...items, val])
    setNewItem('')
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditingVal(items[idx])
  }

  function commitEdit() {
    if (editingIdx === null) return
    const val = editingVal.trim()
    if (!val) { setEditingIdx(null); return }
    const updated = items.map((item, i) => (i === editingIdx ? val : item))
    onChange(updated)
    setEditingIdx(null)
  }

  function cancelEdit() {
    setEditingIdx(null)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {items.length}
        </span>
      </div>
      <p className="mb-4 text-xs text-gray-400">{description}</p>

      {/* List */}
      <ul className="mb-4 space-y-1.5">
        {items.length === 0 && (
          <li className="rounded-xl bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
            No items yet.
          </li>
        )}
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
          >
            {/* Index badge */}
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {idx + 1}
            </span>

            {editingIdx === idx ? (
              /* ── Edit mode ─────────────────────────────────────────── */
              <>
                <input
                  autoFocus
                  className="flex-1 rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none"
                  value={editingVal}
                  onChange={(e) => setEditingVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                {/* Save */}
                <button
                  onClick={commitEdit}
                  className="rounded-lg p-1 text-green-500 transition-colors hover:bg-green-50"
                  title="Save"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                {/* Cancel */}
                <button
                  onClick={cancelEdit}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100"
                  title="Cancel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              /* ── Read mode ─────────────────────────────────────────── */
              <>
                <span className="flex-1 text-sm font-medium text-gray-900">{item}</span>
                {/* Edit */}
                <button
                  onClick={() => startEdit(idx)}
                  className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                  title={`Edit ${item}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
                {/* Remove */}
                <button
                  onClick={() => remove(idx)}
                  className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title={`Remove ${item}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Add row */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={!newItem.trim()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          + Add
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

const PROBABILITY_STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']

const STAGE_ACCENTS: Record<string, string> = {
  Discovery: '#3b82f6', Proposal: '#f59e0b', Negotiation: '#f97316', Win: '#10b981', Loss: '#ef4444',
}

export default function SettingsTab({
  managers,
  products,
  headOfSales,
  partners,
  managerColors,
  probabilityDefaults,
  onManagersChange,
  onProductsChange,
  onHeadOfSalesChange,
  onPartnersChange,
  onManagerColorChange,
  onProbabilityDefaultsChange,
}: {
  managers: string[]
  products: string[]
  headOfSales: string
  partners: string[]
  managerColors: Record<string, string>
  probabilityDefaults: Record<string, number>
  onManagersChange: (v: string[]) => void
  onProductsChange: (v: string[]) => void
  onHeadOfSalesChange: (v: string) => void
  onPartnersChange: (v: string[]) => void
  onManagerColorChange: (name: string, color: string) => void
  onProbabilityDefaultsChange: (v: Record<string, number>) => void
}) {
  const [hosEditing, setHosEditing] = useState(false)
  const [hosVal, setHosVal]         = useState(headOfSales)

  function commitHos() {
    const v = hosVal.trim()
    onHeadOfSalesChange(v)
    setHosEditing(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-gray-900">Settings</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          Manage lists and roles. Targets are managed in the Targets tab.
        </p>
      </div>

      {/* ── Head of Sales ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          <h3 className="text-sm font-bold text-gray-900">Head of Sales</h3>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Sees all pipeline data and aggregated analytics. Not counted as a sales team member.
        </p>
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">1</span>
          {hosEditing ? (
            <>
              <input
                autoFocus
                className="flex-1 rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none"
                value={hosVal}
                onChange={(e) => setHosVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitHos(); if (e.key === 'Escape') setHosEditing(false) }}
              />
              <button onClick={commitHos} className="rounded-lg p-1 text-green-500 hover:bg-green-50 transition-colors" title="Save">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </button>
              <button onClick={() => setHosEditing(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors" title="Cancel">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium text-gray-900">{headOfSales || <span className="text-gray-400">Not set</span>}</span>
              <button onClick={() => { setHosVal(headOfSales); setHosEditing(true) }} className="rounded-lg p-1 text-gray-300 hover:bg-blue-50 hover:text-blue-500 transition-colors" title="Edit">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" /></svg>
              </button>
              <button onClick={() => { onHeadOfSalesChange(''); setHosVal('') }} className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors" title="Clear">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Probability defaults ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          <h3 className="text-sm font-bold text-gray-900">Default Probability % by Stage</h3>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          Used for an opportunity&apos;s Probability % and Weighted Value when no probability is set manually on the deal.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PROBABILITY_STAGES.map((stage) => (
            <div key={stage} className="rounded-xl bg-gray-50 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_ACCENTS[stage] }} />
                <span className="text-xs font-semibold text-gray-700">{stage}</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-gray-900 focus:border-blue-400 focus:outline-none"
                  value={probabilityDefaults[stage] ?? 0}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                    onProbabilityDefaultsChange({ ...probabilityDefaults, [stage]: v })
                  }}
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lists ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListEditor
          title="Sales Managers"
          description="Names available in the Owner field on all opportunities. Pick a color for each manager — it is used in all charts and analytics."
          items={managers}
          onChange={onManagersChange}
          placeholder="e.g. David"
          accent="#3b82f6"
          itemColors={managerColors}
          onItemColorChange={onManagerColorChange}
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

function ListEditor({
  title,
  description,
  items,
  onChange,
  placeholder,
  accent,
  itemColors,
  onItemColorChange,
}: {
  title: string
  description: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
  accent: string
  itemColors?: Record<string, string>
  onItemColorChange?: (item: string, color: string) => void
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
            {/* Index badge — uses the item's own color when colors are enabled */}
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: itemColors?.[item] ?? accent }}
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
                {/* Color picker */}
                {itemColors && onItemColorChange && (
                  <label
                    className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-transform hover:scale-110"
                    style={{ backgroundColor: itemColors[item] ?? accent }}
                    title={`Change color for ${item}`}
                  >
                    <input
                      type="color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={itemColors[item] ?? accent}
                      onChange={(e) => onItemColorChange(item, e.target.value)}
                    />
                  </label>
                )}
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

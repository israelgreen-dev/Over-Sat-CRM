'use client'

import { useState } from 'react'
import {
  NOTIFICATION_EVENTS, EVENT_LABELS, NOTIFY_ROLES, NOTIFY_ROLE_LABELS,
  DEFAULT_NOTIFICATION_CONFIG,
  type NotificationConfig, type NotificationSettings, type NotificationMode, type NotifyRole,
} from '@/lib/notification-types'

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
  managerTerritories,
  probabilityDefaults,
  onManagersChange,
  onProductsChange,
  onHeadOfSalesChange,
  onPartnersChange,
  onManagerColorChange,
  onManagerTerritoryChange,
  onProbabilityDefaultsChange,
  notificationSettings = DEFAULT_NOTIFICATION_CONFIG,
  onNotificationSettingsChange,
}: {
  managers: string[]
  products: string[]
  headOfSales: string
  partners: string[]
  managerColors: Record<string, string>
  managerTerritories: Record<string, string>
  probabilityDefaults: Record<string, number>
  onManagersChange: (v: string[]) => void
  onProductsChange: (v: string[]) => void
  onHeadOfSalesChange: (v: string) => void
  onPartnersChange: (v: string[]) => void
  onManagerColorChange: (name: string, color: string) => void
  onManagerTerritoryChange: (name: string, territory: string) => void
  onProbabilityDefaultsChange: (v: Record<string, number>) => void
  notificationSettings?: NotificationConfig
  onNotificationSettingsChange?: (v: NotificationConfig) => void
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
          Sees all opportunity data and aggregated analytics. Not counted as a sales team member.
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

      {/* ── Email notifications — independent per role ─────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <h3 className="text-sm font-bold text-gray-900">Email Notifications</h3>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          Admin and Head of Sales are configured separately — each group has its own delivery
          schedule and event selection, sent to every user of that role. Sending requires the
          SMTP settings to be configured on the server (see the deployment notes).
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {NOTIFY_ROLES.map((role) => (
            <RoleNotificationPanel
              key={role}
              role={role}
              settings={notificationSettings[role]}
              onChange={(v) => onNotificationSettingsChange?.({ ...notificationSettings, [role]: v })}
            />
          ))}
        </div>
      </div>

      {/* ── Lists ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListEditor
          title="Sales Managers"
          description="Names available in the Owner field on all opportunities. Pick a color for each manager — it is used in all charts and analytics. Reorder with the arrows or sort A–Z."
          items={managers}
          onChange={onManagersChange}
          placeholder="e.g. David"
          accent="#3b82f6"
          itemColors={managerColors}
          onItemColorChange={onManagerColorChange}
          itemTerritories={managerTerritories}
          onItemTerritoryChange={onManagerTerritoryChange}
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
          description="Partners can view all opportunity data and analytics but cannot access Settings."
          items={partners}
          onChange={onPartnersChange}
          placeholder="e.g. Acme Corp"
          accent="#10b981"
        />
      </div>
    </div>
  )
}

// One role's notification configuration (Admin / Head of Sales).
function RoleNotificationPanel({
  role,
  settings,
  onChange,
}: {
  role: NotifyRole
  settings: NotificationSettings
  onChange: (v: NotificationSettings) => void
}) {
  const accent = role === 'admin' ? 'bg-purple-500' : 'bg-slate-600'
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h4 className="text-sm font-bold text-gray-900">{NOTIFY_ROLE_LABELS[role]}</h4>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2">
          <span className={`text-xs font-semibold ${settings.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
            {settings.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
            className={`relative h-6 w-11 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
            title={settings.enabled ? `Turn ${NOTIFY_ROLE_LABELS[role]} notifications off` : `Turn ${NOTIFY_ROLE_LABELS[role]} notifications on`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${settings.enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>

      <div className={settings.enabled ? '' : 'pointer-events-none opacity-40'}>
        {/* Delivery mode */}
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Delivery</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([
            ['instant', 'On every event'],
            ['daily',   'Daily'],
            ['weekly',  'Weekly (Mon)'],
            ['monthly', 'Monthly (1st)'],
          ] as [NotificationMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...settings, mode })}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                settings.mode === mode
                  ? 'bg-rose-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Event toggles */}
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Notify about</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {NOTIFICATION_EVENTS.map((ev) => {
            const on = settings.events?.[ev] !== false
            return (
              <label key={ev} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 border border-gray-100">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange({ ...settings, events: { ...settings.events, [ev]: !on } })}
                  className="h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-400"
                />
                <span className="text-xs text-gray-700">{EVENT_LABELS[ev]}</span>
              </label>
            )
          })}
        </div>

        {/* Recipients override */}
        <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Send to</p>
        <input
          type="text"
          value={(settings.recipients ?? []).join(', ')}
          onChange={(e) => onChange({
            ...settings,
            recipients: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder={`Auto — every ${NOTIFY_ROLE_LABELS[role]} user`}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-rose-400 focus:outline-none transition-colors"
        />
        <p className="mt-1 text-[11px] text-gray-400">
          Comma-separated email addresses. Leave empty to send automatically to every {NOTIFY_ROLE_LABELS[role]} user.
        </p>
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
  itemTerritories,
  onItemTerritoryChange,
}: {
  title: string
  description: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
  accent: string
  itemColors?: Record<string, string>
  onItemColorChange?: (item: string, color: string) => void
  itemTerritories?: Record<string, string>
  onItemTerritoryChange?: (item: string, territory: string) => void
}) {
  const [newItem, setNewItem]     = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingVal, setEditingVal] = useState('')
  // Direction the next click of the sort button will apply (toggles each click).
  const [sortAsc, setSortAsc]     = useState(true)

  function add() {
    const val = newItem.trim()
    if (!val || items.map((i) => i.toLowerCase()).includes(val.toLowerCase())) return
    onChange([...items, val])
    setNewItem('')
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  function toggleSort() {
    onChange([...items].sort((a, b) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a))))
    setSortAsc((v) => !v)
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
        {items.length > 1 && (
          <button
            onClick={toggleSort}
            title={sortAsc ? 'Sort A–Z' : 'Sort Z–A'}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sortAsc
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m4 6l3 3m0 0l3-3m-3 3V4" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h5M3 8h9M3 12h13m4-8l3-3m0 0l3 3m-3-3v18" />}
            </svg>
            {sortAsc ? 'A–Z' : 'Z–A'}
          </button>
        )}
        <span className={`${items.length > 1 ? '' : 'ml-auto'} rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500`}>
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
            className="rounded-xl bg-gray-50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
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
                {/* Reorder up / down */}
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-gray-300 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="rounded p-0.5 text-gray-300 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
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
                {/* Remove — trash icon, consistent with row deletes everywhere */}
                <button
                  onClick={() => remove(idx)}
                  className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title={`Delete ${item}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            </div>

            {/* Territory — free text, only when enabled (Sales Managers) */}
            {itemTerritories && onItemTerritoryChange && editingIdx !== idx && (
              <div className="mt-2 flex items-center gap-2 pl-8">
                <svg className="h-3.5 w-3.5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Territory (e.g. EMEA, West Coast)…"
                  value={itemTerritories[item] ?? ''}
                  onChange={(e) => onItemTerritoryChange(item, e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>
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

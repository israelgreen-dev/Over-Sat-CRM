'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { type Opportunity, SearchableSelect, COUNTRIES, OPPORTUNITY_TYPES, LEAD_SOURCES, PRIORITIES, PRIORITY_ICONS } from './OpportunitiesTable'

/**
 * LeadsTab — a lightweight pre-pipeline stage.
 * A lead holds only the essentials (account, contact, country, description)
 * and can be converted into a full opportunity with one click.
 */

export type Lead = {
  id: string
  account: string
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_linkedin: string | null
  country: string | null
  owner: string | null
  status: string | null
  description: string | null
  source: string | null
  opportunity_type: string | null
  priority: string | null
  website: string | null
  converted_opportunity_id: string | null
  created_at: string
  updated_at: string
}

const STATUSES = ['New', 'Contacted', 'Qualified', 'Dropped'] as const

const STATUS_COLORS: Record<string, string> = {
  New:       'bg-blue-100 text-blue-700',
  Contacted: 'bg-amber-100 text-amber-700',
  Qualified: 'bg-green-100 text-green-700',
  Dropped:   'bg-gray-100 text-gray-500',
  Converted: 'bg-emerald-100 text-emerald-700',
}

// LEAD_SOURCES / PRIORITIES / PRIORITY_ICONS are shared with opportunities
// and live in OpportunitiesTable.

type LeadForm = {
  account: string
  website: string
  contact_name: string
  contact_title: string
  contact_email: string
  contact_phone: string
  contact_linkedin: string
  country: string
  owner: string
  status: string
  source: string
  opportunity_type: string
  priority: string
  description: string
}

const emptyForm = (owner: string): LeadForm => ({
  account: '', website: '', contact_name: '', contact_title: '', contact_email: '', contact_phone: '', contact_linkedin: '',
  country: '', owner, status: 'New', source: '', opportunity_type: '', priority: 'Medium', description: '',
})

const updatedFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

// Sortable columns (Actions has no field). Mirrors the Opportunities table.
const LEAD_COLUMNS: { label: string; field: string }[] = [
  { label: 'Account',       field: 'account' },
  { label: 'Sales Manager', field: 'owner' },
  { label: 'Contact',       field: 'contact_name' },
  { label: 'Country',       field: 'country' },
  { label: 'Source',        field: 'source' },
  { label: 'Priority',      field: 'priority' },
  { label: 'Status',        field: 'status' },
  { label: 'Description',   field: 'description' },
  { label: 'Updated',       field: 'updated_at' },
  { label: 'Actions',       field: '' },
]
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

function leadSortValue(l: Lead, field: string): string | number {
  if (field === 'updated_at') return new Date(l.updated_at).getTime()
  if (field === 'priority')   return PRIORITY_RANK[l.priority ?? 'Medium'] ?? 1
  return String((l as Record<string, unknown>)[field] ?? '').toLowerCase()
}

export default function LeadsTab({
  leads,
  loading,
  error,
  onReload,
  managers,
  currentUserName,
  lockedOwner,
  readOnly = false,
  onOppAdded,
  addFormOpen = false,
  onAddFormOpenChange,
  managerColors = {},
}: {
  /** Lead data owned by the Dashboard so the banner/analytics stay in sync. */
  leads: Lead[]
  loading: boolean
  error: string | null
  onReload: () => void
  managers: string[]
  /** Display name of the signed-in user (used as the default owner). */
  currentUserName: string
  /** Set for manager role — owner is fixed to their own name. */
  lockedOwner?: string
  /** Partners: view only. */
  readOnly?: boolean
  /** Called with the new opportunity after a successful conversion. */
  onOppAdded: (opp: Opportunity) => void
  /** External signal (header button) to open the new-lead form. */
  addFormOpen?: boolean
  onAddFormOpenChange?: (v: boolean) => void
  managerColors?: Record<string, string>
}) {
  const [statusFilter, setStatusFilter]   = useState('')
  const [search, setSearch]               = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterSource, setFilterSource]   = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const [editing, setEditing]   = useState<Lead | 'new' | null>(null)
  const [form, setForm]         = useState<LeadForm>(emptyForm(''))
  const [busy, setBusy]         = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Convert flow state
  const [converting, setConverting]   = useState<Lead | null>(null)
  const [convertName, setConvertName] = useState('')
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [sortKey, setSortKey]         = useState('')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('asc')
  const searchRef                     = useRef<HTMLInputElement>(null)

  function handleSort(field: string) {
    if (!field) return
    if (sortKey === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(field); setSortDir('asc') }
  }

  const defaultOwner = lockedOwner ?? (managers.includes(currentUserName) ? currentUserName : '')

  // Header "+ New Lead" button: consume the external open signal.
  useEffect(() => {
    if (addFormOpen && !readOnly) {
      setForm(emptyForm(defaultOwner))
      setFormError(null)
      setEditing('new')
      onAddFormOpenChange?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addFormOpen])

  const visible = useMemo(() => leads.filter((l) => {
    if (statusFilter && (l.status ?? 'New') !== statusFilter) return false
    if (filterManager && (l.owner ?? '').toLowerCase() !== filterManager.toLowerCase()) return false
    if (filterCountry && (l.country ?? '') !== filterCountry) return false
    if (filterSource && (l.source ?? '') !== filterSource) return false
    if (filterPriority && (l.priority ?? 'Medium') !== filterPriority) return false
    if (search) {
      const q = search.trim().toLowerCase()
      const hit =
        l.account.toLowerCase().includes(q) ||
        (l.contact_name ?? '').toLowerCase().includes(q) ||
        (l.contact_email ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q) ||
        (l.owner ?? '').toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  }), [leads, statusFilter, filterManager, filterCountry, filterSource, filterPriority, search])

  // Sorted view — same click-to-sort mechanism as the Opportunities table.
  const sorted = useMemo(() => {
    if (!sortKey) return visible
    return [...visible].sort((a, b) => {
      const av = leadSortValue(a, sortKey)
      const bv = leadSortValue(b, sortKey)
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visible, sortKey, sortDir])

  const countryOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.country ?? '').filter(Boolean))).sort(),
    [leads],
  )
  const anyFilterActive = !!(statusFilter || filterManager || filterCountry || filterSource || filterPriority || search)
  function clearAllFilters() {
    setStatusFilter(''); setFilterManager(''); setFilterCountry(''); setFilterSource(''); setFilterPriority(''); setSearch('')
  }

  const activeCount = leads.filter((l) => !['Dropped', 'Converted'].includes(l.status ?? 'New')).length

  function openNew() {
    setForm(emptyForm(defaultOwner))
    setFormError(null)
    setEditing('new')
  }

  function openEdit(lead: Lead) {
    setForm({
      account: lead.account ?? '', website: lead.website ?? '',
      contact_name: lead.contact_name ?? '', contact_title: lead.contact_title ?? '',
      contact_email: lead.contact_email ?? '', contact_phone: lead.contact_phone ?? '',
      contact_linkedin: lead.contact_linkedin ?? '',
      country: lead.country ?? '', owner: lead.owner ?? '',
      status: lead.status ?? 'New', source: lead.source ?? '',
      opportunity_type: lead.opportunity_type ?? '', priority: lead.priority ?? 'Medium',
      description: lead.description ?? '',
    })
    setFormError(null)
    setEditing(lead)
  }

  async function saveLead() {
    if (!form.account.trim()) { setFormError('Account is required.'); return }
    setBusy(true)
    setFormError(null)
    const payload: Record<string, unknown> = {
      account: form.account.trim(),
      website: form.website.trim(),
      contact_name: form.contact_name.trim(),
      contact_title: form.contact_title.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      contact_linkedin: form.contact_linkedin.trim(),
      country: form.country,
      owner: lockedOwner ?? form.owner,
      status: form.status,
      source: form.source,
      opportunity_type: form.opportunity_type,
      priority: form.priority,
      description: form.description.trim(),
    }
    // Progressive fallback: strip columns that predate migration 011.
    let sbError: { message: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = editing === 'new'
        ? await supabase.from('leads').insert([payload])
        : await supabase.from('leads').update(payload).eq('id', (editing as Lead).id)
      sbError = error
      if (!error) break
      if (error.message?.includes('contact_title'))    { delete payload.contact_title;    continue }
      if (error.message?.includes('contact_linkedin')) { delete payload.contact_linkedin; continue }
      if (error.message?.includes('website'))          { delete payload.website;          continue }
      if (error.message?.includes('source'))           { delete payload.source;           continue }
      if (error.message?.includes('opportunity_type')) { delete payload.opportunity_type; continue }
      if (error.message?.includes('priority'))         { delete payload.priority;         continue }
      break
    }
    setBusy(false)
    if (sbError) { setFormError(sbError.message); return }
    setEditing(null)
    onReload()
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`Delete lead "${lead.account}"? This cannot be undone.`)) return
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setEditing(null)
    onReload()
  }

  // Quick delete straight from a table row (same trash mechanism as the
  // Opportunities table). stopPropagation keeps the row click from opening
  // the edit modal.
  async function handleRowDelete(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    if (deletingId) return
    if (!confirm(`Permanently delete lead "${lead.account || 'this lead'}"? This cannot be undone.`)) return
    setDeletingId(lead.id)
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    setDeletingId(null)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    onReload()
  }

  function startConvert(lead: Lead) {
    setConvertName(lead.account)
    setConverting(lead)
  }

  async function confirmConvert() {
    if (!converting || !convertName.trim()) return
    setBusy(true)
    // 1. Create the opportunity (Discovery, no value yet — filled in later)
    const oppPayload: Record<string, unknown> = {
      name: convertName.trim(),
      customer_name: converting.account,
      owner: converting.owner || null,
      stage: 'Discovery',
      status: 'On Track',
      product: null,
      country: converting.country || null,
      currency: 'USD',
      close_date: null,
      value: null,
      loss_reason: null,
      loss_description: null,
      opportunity_type: converting.opportunity_type || null,
      website: converting.website || null,
      source: converting.source || null,
      priority: converting.priority || null,
    }
    let data: any[] | null = null
    let error: { message: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase.from('opportunities').insert([oppPayload]).select()
      data = res.data; error = res.error
      if (!res.error) break
      if (res.error.message?.includes('opportunity_type')) { delete oppPayload.opportunity_type; continue }
      if (res.error.message?.includes('website'))           { delete oppPayload.website;          continue }
      if (res.error.message?.includes('source'))            { delete oppPayload.source;           continue }
      if (res.error.message?.includes('priority'))          { delete oppPayload.priority;         continue }
      break
    }
    if (error) { setBusy(false); alert(`Convert failed: ${error.message}`); return }
    const newOpp = (data?.[0] ?? oppPayload) as Opportunity

    // 2. Carry the lead's contact over (best-effort)
    if (converting.contact_name || converting.contact_email) {
      await supabase.from('opportunity_contacts').insert([{
        opportunity_id: String(newOpp.id),
        name: converting.contact_name || '—',
        title: converting.contact_title || null,
        email: converting.contact_email || null,
        phone: converting.contact_phone || null,
        organization: converting.account,
        note: [
          'Carried over from lead',
          converting.contact_linkedin ? `LinkedIn: ${converting.contact_linkedin}` : '',
        ].filter(Boolean).join(' · '),
      }])
    }

    // 3. Carry the lead's description over as the deal's first note
    if (converting.description?.trim()) {
      await supabase.from('notes').insert([{
        opportunity_id: String(newOpp.id),
        content: `From lead: ${converting.description.trim()}`,
      }])
    }

    // 4. Mark the lead converted
    await supabase.from('leads')
      .update({ status: 'Converted', converted_opportunity_id: String(newOpp.id) })
      .eq('id', converting.id)

    setBusy(false)
    setConverting(null)
    setEditing(null)
    onOppAdded(newOpp)
    onReload()
  }

  const inputCls = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'

  return (
    // Same white card frame as the Opportunities tab.
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Leads</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            {activeCount} active lead{activeCount !== 1 ? 's' : ''} · qualify here, then convert to an opportunity.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Lead
          </button>
        )}
      </div>

      {/* ── Manager quick filter (full-access views) ─────────────────────── */}
      {!lockedOwner && managers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quick filter:</span>
          <button
            onClick={() => setFilterManager('')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterManager === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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

      {/* ── Status chips ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status:</span>
        <button
          onClick={() => setStatusFilter('')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${statusFilter === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {[...STATUSES, 'Converted'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Search bar (same as Opportunities) ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by account, contact, country or manager…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); searchRef.current?.focus() }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-700"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {anyFilterActive && (
          <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
            {sorted.length} / {leads.length}
          </span>
        )}
      </div>

      {/* ── Dropdown filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-6">
        {!lockedOwner && managers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Manager</span>
            <select
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
            >
              <option value="">All Managers</option>
              {managers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Country</span>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
          >
            <option value="">All Countries</option>
            {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Source</span>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
          >
            <option value="">All Sources</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_ICONS[p]} {p}</option>)}
          </select>
        </div>
        {anyFilterActive && (
          <span className="flex items-center gap-3 text-xs text-gray-400">
            <button onClick={clearAllFilters} className="transition-colors hover:text-gray-700">Clear all</button>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Loading leads…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-gray-400">
            {error.includes('does not exist') || error.includes('schema cache')
              ? 'Leads are not enabled yet — run migration 010 in Supabase to activate this tab.'
              : `Failed to load leads: ${error}`}
          </p>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-500">No leads{statusFilter || search ? ' match the filters' : ' yet'}.</p>
            {!readOnly && !statusFilter && !search && (
              <p className="mt-1 text-xs text-gray-400">Click <span className="font-semibold text-emerald-600">New Lead</span> to capture your first prospect.</p>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {LEAD_COLUMNS.map(({ label, field }) => {
                  const active = sortKey === field
                  return (
                    <th key={label} className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${label === 'Actions' ? 'text-right' : 'text-left'}`}>
                      {field ? (
                        <button onClick={() => handleSort(field)} className="inline-flex items-center gap-1 transition-colors hover:text-gray-800">
                          {label}
                          <span className="flex flex-col leading-none text-[9px]">
                            <span className={active && sortDir === 'asc'  ? 'text-blue-500' : 'text-gray-300'}>▲</span>
                            <span className={active && sortDir === 'desc' ? 'text-blue-500' : 'text-gray-300'}>▼</span>
                          </span>
                        </button>
                      ) : label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sorted.map((lead) => {
                const converted = (lead.status ?? '') === 'Converted'
                return (
                  <tr
                    key={lead.id}
                    onClick={() => !readOnly && !converted && openEdit(lead)}
                    className={`transition-colors ${!readOnly && !converted ? 'cursor-pointer hover:bg-gray-50' : ''} ${converted ? 'opacity-60' : ''}`}
                  >
                    {/* Account (+ website) */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium text-gray-900">{lead.account}</p>
                      {lead.website && (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          {lead.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </td>
                    {/* Sales Manager */}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{lead.owner || '—'}</td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-gray-700">
                        {lead.contact_name || '—'}
                        {lead.contact_linkedin && (
                          <a
                            href={lead.contact_linkedin.startsWith('http') ? lead.contact_linkedin : `https://${lead.contact_linkedin}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="LinkedIn profile"
                            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#0a66c2] align-text-bottom text-[9px] font-bold text-white hover:opacity-80"
                          >
                            in
                          </a>
                        )}
                      </p>
                      {lead.contact_title && <p className="text-xs text-gray-500">{lead.contact_title}</p>}
                      {lead.contact_email && <p className="text-xs text-gray-400">{lead.contact_email}</p>}
                    </td>
                    {/* Country */}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{lead.country || '—'}</td>
                    {/* Source */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{lead.source || '—'}</td>
                    {/* Priority */}
                    <td className="whitespace-nowrap px-4 py-3 text-base" title={`${lead.priority ?? 'Medium'} priority`}>
                      {PRIORITY_ICONS[lead.priority ?? 'Medium'] ?? '🟡'}
                    </td>
                    {/* Status */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status ?? 'New'] ?? 'bg-gray-100 text-gray-600'}`}>
                        {lead.status ?? 'New'}
                      </span>
                    </td>
                    {/* Description */}
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-gray-500" title={lead.description ?? ''}>
                      {lead.description || '—'}
                    </td>
                    {/* Updated */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{updatedFmt.format(new Date(lead.updated_at))}</td>
                    {/* Actions — convert + delete */}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!readOnly && !converted && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startConvert(lead) }}
                            title="Convert this lead into an opportunity"
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-100"
                          >
                            Convert →
                          </button>
                        )}
                        {converted && (
                          <span className="text-xs font-medium text-emerald-600">✓ In Opportunities</span>
                        )}
                        {!readOnly && (
                          <button
                            onClick={(e) => handleRowDelete(e, lead)}
                            disabled={deletingId === lead.id}
                            title="Delete lead"
                            aria-label={`Delete ${lead.account}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === lead.id ? (
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
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit modal ─────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">{editing === 'new' ? 'New Lead' : 'Edit Lead'}</h3>
              <button onClick={() => setEditing(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Company Name *</label>
                <input autoFocus className={inputCls} placeholder="Company or account" value={form.account} onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Website</label>
                <input type="url" className={inputCls} placeholder="https://company.com" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
              {/* ── Contact Information ─────────────────────────────────── */}
              <p className="col-span-2 mt-1 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Contact Information</p>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Name</label>
                <input className={inputCls} placeholder="Full name" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Job Title</label>
                <input className={inputCls} placeholder="e.g. VP Engineering" value={form.contact_title} onChange={(e) => setForm((f) => ({ ...f, contact_title: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Email</label>
                <input type="email" className={inputCls} placeholder="name@company.com" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Mobile Phone</label>
                <input className={inputCls} placeholder="+972…" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">LinkedIn Profile</label>
                <input type="url" className={inputCls} placeholder="https://linkedin.com/in/…" value={form.contact_linkedin} onChange={(e) => setForm((f) => ({ ...f, contact_linkedin: e.target.value }))} />
              </div>

              {/* ── Lead Details ────────────────────────────────────────── */}
              <p className="col-span-2 mt-1 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Lead Details</p>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Country</label>
                <SearchableSelect value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} options={COUNTRIES} placeholder="Search country…" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Sales Manager</label>
                {lockedOwner ? (
                  <p className={`${inputCls} bg-zinc-100 text-zinc-500`}>{lockedOwner}</p>
                ) : (
                  <select className={inputCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                    <option value="">— Unassigned —</option>
                    {managers.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Status</label>
                <select className={inputCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Lead Source</label>
                <select className={inputCls} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">— Select source —</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Opportunity Type</label>
                <select className={inputCls} value={form.opportunity_type} onChange={(e) => setForm((f) => ({ ...f, opportunity_type: e.target.value }))}>
                  <option value="">— Select type —</option>
                  {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Priority</label>
                <select className={inputCls} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_ICONS[p]} {p}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Description</label>
                <textarea rows={3} className={`${inputCls} resize-none`} placeholder="What is this lead about? Needs, source, next step…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-red-500">{formError}</p>}

            <div className="mt-5 flex items-center justify-between">
              <div>
                {editing !== 'new' && (
                  <button onClick={() => deleteLead(editing as Lead)} className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50">
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editing !== 'new' && (
                  <button
                    onClick={() => startConvert(editing as Lead)}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
                  >
                    Convert to Opportunity →
                  </button>
                )}
                <button onClick={saveLead} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
                  {busy ? 'Saving…' : 'Save Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Convert confirmation ─────────────────────────────────────────── */}
      {converting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-900">Convert to Opportunity</h3>
            <p className="mb-4 text-sm text-gray-400">
              Creates a Discovery-stage opportunity for <strong className="text-gray-700">{converting.account}</strong>
              {converting.contact_name ? ` and carries ${converting.contact_name} over as a contact` : ''}. The lead is kept and marked Converted.
            </p>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Opportunity Name</label>
            <input autoFocus className={inputCls} value={convertName} onChange={(e) => setConvertName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmConvert() }} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConverting(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100">
                Cancel
              </button>
              <button onClick={confirmConvert} disabled={busy || !convertName.trim()} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50">
                {busy ? 'Converting…' : 'Create Opportunity'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

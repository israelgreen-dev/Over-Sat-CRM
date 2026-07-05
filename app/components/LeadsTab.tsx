'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type Opportunity, SearchableSelect, COUNTRIES } from './OpportunitiesTable'

/**
 * LeadsTab — a lightweight pre-pipeline stage.
 * A lead holds only the essentials (account, contact, country, description)
 * and can be converted into a full opportunity with one click.
 */

export type Lead = {
  id: string
  account: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  country: string | null
  owner: string | null
  status: string | null
  description: string | null
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

type LeadForm = {
  account: string
  contact_name: string
  contact_email: string
  contact_phone: string
  country: string
  owner: string
  status: string
  description: string
}

const emptyForm = (owner: string): LeadForm => ({
  account: '', contact_name: '', contact_email: '', contact_phone: '',
  country: '', owner, status: 'New', description: '',
})

const updatedFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

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
}) {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')

  const [editing, setEditing]   = useState<Lead | 'new' | null>(null)
  const [form, setForm]         = useState<LeadForm>(emptyForm(''))
  const [busy, setBusy]         = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Convert flow state
  const [converting, setConverting]   = useState<Lead | null>(null)
  const [convertName, setConvertName] = useState('')

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
    if (search) {
      const q = search.trim().toLowerCase()
      const hit =
        l.account.toLowerCase().includes(q) ||
        (l.contact_name ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q) ||
        (l.owner ?? '').toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  }), [leads, statusFilter, search])

  const activeCount = leads.filter((l) => !['Dropped', 'Converted'].includes(l.status ?? 'New')).length

  function openNew() {
    setForm(emptyForm(defaultOwner))
    setFormError(null)
    setEditing('new')
  }

  function openEdit(lead: Lead) {
    setForm({
      account: lead.account ?? '', contact_name: lead.contact_name ?? '',
      contact_email: lead.contact_email ?? '', contact_phone: lead.contact_phone ?? '',
      country: lead.country ?? '', owner: lead.owner ?? '',
      status: lead.status ?? 'New', description: lead.description ?? '',
    })
    setFormError(null)
    setEditing(lead)
  }

  async function saveLead() {
    if (!form.account.trim()) { setFormError('Account is required.'); return }
    setBusy(true)
    setFormError(null)
    const payload = {
      account: form.account.trim(),
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      country: form.country,
      owner: lockedOwner ?? form.owner,
      status: form.status,
      description: form.description.trim(),
    }
    const { error } = editing === 'new'
      ? await supabase.from('leads').insert([payload])
      : await supabase.from('leads').update(payload).eq('id', (editing as Lead).id)
    setBusy(false)
    if (error) { setFormError(error.message); return }
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

  function startConvert(lead: Lead) {
    setConvertName(lead.account)
    setConverting(lead)
  }

  async function confirmConvert() {
    if (!converting || !convertName.trim()) return
    setBusy(true)
    // 1. Create the opportunity (Discovery, no value yet — filled in later)
    const oppPayload = {
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
    }
    const { data, error } = await supabase.from('opportunities').insert([oppPayload]).select()
    if (error) { setBusy(false); alert(`Convert failed: ${error.message}`); return }
    const newOpp = (data?.[0] ?? oppPayload) as Opportunity

    // 2. Carry the lead's contact over (best-effort)
    if (converting.contact_name || converting.contact_email) {
      await supabase.from('opportunity_contacts').insert([{
        opportunity_id: String(newOpp.id),
        name: converting.contact_name || '—',
        email: converting.contact_email || null,
        phone: converting.contact_phone || null,
        organization: converting.account,
        note: 'Carried over from lead',
      }])
    }

    // 3. Mark the lead converted
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
    <div className="space-y-4">

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
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Lead
          </button>
        )}
      </div>

      {/* Filters */}
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="ml-auto w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Loading leads…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-gray-400">
            {error.includes('does not exist') || error.includes('schema cache')
              ? 'Leads are not enabled yet — run migration 010 in Supabase to activate this tab.'
              : `Failed to load leads: ${error}`}
          </p>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-500">No leads{statusFilter || search ? ' match the filters' : ' yet'}.</p>
            {!readOnly && !statusFilter && !search && (
              <p className="mt-1 text-xs text-gray-400">Click <span className="font-semibold text-orange-500">New Lead</span> to capture your first prospect.</p>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Account', 'Contact', 'Country', 'Manager', 'Status', 'Description', 'Updated', ''].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visible.map((lead) => {
                const converted = (lead.status ?? '') === 'Converted'
                return (
                  <tr
                    key={lead.id}
                    onClick={() => !readOnly && !converted && openEdit(lead)}
                    className={`transition-colors ${!readOnly && !converted ? 'cursor-pointer hover:bg-gray-50' : ''} ${converted ? 'opacity-60' : ''}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{lead.account}</td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-gray-700">{lead.contact_name || '—'}</p>
                      {lead.contact_email && <p className="text-xs text-gray-400">{lead.contact_email}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{lead.country || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{lead.owner || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status ?? 'New'] ?? 'bg-gray-100 text-gray-600'}`}>
                        {lead.status ?? 'New'}
                      </span>
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-xs text-gray-500" title={lead.description ?? ''}>
                      {lead.description || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{updatedFmt.format(new Date(lead.updated_at))}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
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
                        <span className="text-xs font-medium text-emerald-600">✓ In pipeline</span>
                      )}
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
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Account *</label>
                <input autoFocus className={inputCls} placeholder="Company or account" value={form.account} onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Name</label>
                <input className={inputCls} placeholder="Full name" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Email</label>
                <input type="email" className={inputCls} placeholder="name@company.com" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Phone</label>
                <input className={inputCls} placeholder="+972…" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
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

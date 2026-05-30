'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toUSD } from '@/lib/currency'

export type Opportunity = {
  id: string | number
  name: string
  customer_name: string
  stage: string
  product: string | null
  owner: string | null
  value: number | null
  loss_reason: string | null
  loss_description: string | null
  [key: string]: unknown
}

type Draft = {
  name: string
  customer_name: string
  owner: string
  stage: string
  status: string
  product: string
  country: string
  currency: string
  value: number | null
  close_date: string
  final_win_value: number | null
  loss_reason: string
  loss_description: string
}

type Note = {
  id: string
  opportunity_id: string
  content: string
  created_at: string
}

const STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']

function generateQuarters(count = 8): string[] {
  const now   = new Date()
  const year  = now.getFullYear()
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const quarters: string[] = []
  let q = currentQ, y = year
  for (let i = 0; i < count; i++) {
    quarters.push(`Q${q}-${y}`)
    if (++q > 4) { q = 1; y++ }
  }
  return quarters
}

const QUARTERS = generateQuarters()
const PRODUCTS = ['Python5', 'Python7', 'Mantis10', 'Rigel', 'Griffin', 'Scorpion', 'Cameleon']

const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar ($)'     },
  { code: 'EUR', label: 'EUR — Euro (€)'           },
  { code: 'ILS', label: 'ILS — Israeli Shekel (₪)' },
]

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina',
  'Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados',
  'Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Republic)','Congo (Democratic Republic)','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
  'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji',
  'Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada',
  'Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland',
  'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico',
  'Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles',
  'Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa',
  'South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]


export function NumericInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  className?: string
  placeholder?: string
}) {
  function toDisplay(n: number | null) {
    if (n == null || isNaN(n)) return ''
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const [display, setDisplay] = useState(() => toDisplay(value))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      setDisplay('')
      onChange(null)
    } else {
      const n = parseInt(raw, 10)
      setDisplay(n.toLocaleString('en-US', { maximumFractionDigits: 0 }))
      onChange(n)
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
    />
  )
}

export function Modal({
  opportunity,
  onClose,
  onSaved,
  onDeleted,
  isAdmin,
  products: productsProp,
  managers: managersProp,
}: {
  opportunity: Opportunity
  onClose: () => void
  onSaved: (updated: Opportunity) => void
  onDeleted?: () => void
  isAdmin?: boolean
  products?: string[]
  managers?: string[]
}) {
  const [modalTab, setModalTab] = useState<'details' | 'notes' | 'documents' | 'contacts'>('details')
  const [draft, setDraft]       = useState<Draft>(toDraft(opportunity))
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Permanently delete "${opportunity.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabase.from('opportunities').delete().eq('id', opportunity.id)
    setDeleting(false)
    if (error) { setSaveError(error.message); return }
    onDeleted?.()
    onClose()
  }

  const isLost  = draft.stage === 'Loss'
  const isWon   = draft.stage === 'Win'
  const canSave = !isLost || (draft.loss_reason.trim() !== '' && draft.loss_description.trim() !== '')

  async function save() {
    setSaving(true)
    setSaveError(null)

    const finalWinValue = isWon ? (draft.final_win_value || draft.value) : null

    const payload = {
      name:              draft.name,
      customer_name:     draft.customer_name,
      owner:             draft.owner || null,
      stage:             draft.stage,
      status:            draft.status || null,
      product:           draft.product || null,
      country:           draft.country || null,
      currency:          draft.currency || 'USD',
      close_date:        draft.close_date || null,
      value:             draft.value,
      final_win_value:   finalWinValue,
      loss_reason:       isLost ? draft.loss_reason : null,
      loss_description:  isLost ? draft.loss_description : null,
    }

    let { error: sbError } = await supabase
      .from('opportunities').update(payload).eq('id', opportunity.id)

    if (sbError && sbError.message?.includes('final_win_value')) {
      const { final_win_value, ...p } = payload
      const { error: e2 } = await supabase.from('opportunities').update(p).eq('id', opportunity.id)
      sbError = e2 ?? null
    }
    if (sbError && sbError.message?.includes('currency')) {
      const { currency, ...p } = payload
      const { error: e2 } = await supabase.from('opportunities').update(p).eq('id', opportunity.id)
      sbError = e2 ?? null
    }

    setSaving(false)
    if (sbError) { setSaveError(sbError.message); return }
    onSaved({ ...opportunity, ...payload })
  }

  async function saveAndClose() { await save(); if (!saveError) onClose() }

  const inputCls  = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'
  const selectCls = inputCls

  const stageColors: Record<string, string> = {
    Discovery:   draft.stage === 'Discovery'   ? 'bg-blue-600 text-white'   : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    Proposal:    draft.stage === 'Proposal'    ? 'bg-yellow-500 text-white'  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    Negotiation: draft.stage === 'Negotiation' ? 'bg-orange-500 text-white'  : 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    Win:         draft.stage === 'Win'         ? 'bg-green-600 text-white'   : 'bg-green-50 text-green-700 hover:bg-green-100',
    Loss:        draft.stage === 'Loss'        ? 'bg-red-600 text-white'     : 'bg-red-50 text-red-700 hover:bg-red-100',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed Header ──────────────────────────────────────────── */}
        <div className="shrink-0 rounded-t-2xl border-b border-zinc-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* Title input */}
            <div className="min-w-0 flex-1">
              <input
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-lg font-bold text-zinc-900 focus:border-blue-400 focus:bg-white focus:outline-none"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Opportunity name…"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <StageBadge stage={draft.stage} />
                {draft.status && <StatusBadge status={draft.status} />}
                {(opportunity as any).created_at && (
                  <span className="text-xs text-zinc-400">{formatTimestamp((opportunity as any).created_at)}</span>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  title="Delete opportunity (Admin only)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={saveAndClose}
                disabled={saving || !canSave}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save & Close'}
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Validation */}
          {isLost && !canSave && (
            <p className="mt-2 text-xs text-red-500">Loss Reason and Loss Description are required.</p>
          )}
          {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}

          {/* Stage pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => ({
                  ...d,
                  stage: s,
                  final_win_value: s === 'Win' && !d.final_win_value ? d.value : d.final_win_value,
                }))}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${stageColors[s] ?? ''}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Tab bar */}
          <div className="mt-3 flex gap-0.5 border-b border-zinc-100">
            {(['details', 'contacts', 'documents', 'notes'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setModalTab(t)}
                className={`relative -mb-px rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  modalTab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {modalTab === 'details' && (
            <>
              <div className="grid grid-cols-2 gap-4">

                <Field label="Account">
                  <input className={inputCls} value={draft.customer_name} onChange={(e) => setDraft((d) => ({ ...d, customer_name: e.target.value }))} />
                </Field>

                <Field label="Sales Manager">
                  {managersProp && managersProp.length > 0
                    ? <select className={selectCls} value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}>
                        <option value="">— Unassigned —</option>
                        {managersProp.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    : <input className={inputCls} value={draft.owner} placeholder="Manager name" onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
                  }
                </Field>

                <Field label="Product">
                  <SearchableSelect
                    value={draft.product}
                    onChange={(v) => setDraft((d) => ({ ...d, product: v }))}
                    options={productsProp ?? PRODUCTS}
                    placeholder="Search product…"
                    className={inputCls}
                  />
                </Field>

                <Field label="Country">
                  <SearchableSelect
                    value={draft.country}
                    onChange={(v) => setDraft((d) => ({ ...d, country: v }))}
                    options={COUNTRIES}
                    placeholder="Search country…"
                    className={inputCls}
                  />
                </Field>

                <Field label="Close Date">
                  <select className={selectCls} value={draft.close_date} onChange={(e) => setDraft((d) => ({ ...d, close_date: e.target.value }))}>
                    <option value="">— Select quarter —</option>
                    {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </Field>

                <Field label="Status">
                  <select className={selectCls} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                    <option value="">— None —</option>
                    {['On Track', 'Risk', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <Field label="Currency">
                  <select className={selectCls} value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}>
                    {CURRENCIES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Value (Forecast)">
                  <NumericInput className={inputCls} value={draft.value} onChange={(v) => setDraft((d) => ({ ...d, value: v }))} />
                </Field>

                {isWon && (
                  <Field label="Win Value">
                    <NumericInput
                      className={`${inputCls} border-green-300 text-green-700 focus:border-green-500`}
                      placeholder="Actual closed amount"
                      value={draft.final_win_value}
                      onChange={(v) => setDraft((d) => ({ ...d, final_win_value: v }))}
                    />
                  </Field>
                )}

              </div>

              {isLost && (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-red-100 bg-red-50 p-4">
                  <Field label="Loss Reason">
                    <select
                      className={`${selectCls} border-red-200 ${draft.loss_reason.trim() === '' ? 'border-red-400' : ''}`}
                      value={draft.loss_reason}
                      onChange={(e) => setDraft((d) => ({ ...d, loss_reason: e.target.value }))}
                    >
                      <option value="">Select a reason…</option>
                      {['Lost to competitor', 'No budget', 'Pricing too high', 'Other'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Loss Description">
                    <textarea
                      rows={2}
                      className={`${inputCls} resize-none ${draft.loss_description.trim() === '' ? 'border-red-400' : ''}`}
                      placeholder="Required"
                      value={draft.loss_description}
                      onChange={(e) => setDraft((d) => ({ ...d, loss_description: e.target.value }))}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          {modalTab === 'notes'     && <NotesPanel     opportunityId={opportunity.id}          />}
          {modalTab === 'documents' && <DocumentsPanel opportunityId={String(opportunity.id)} />}
          {modalTab === 'contacts'  && <ContactsPanel  opportunityId={String(opportunity.id)} />}

        </div>
      </div>
    </div>
  )
}

export function AddOpportunityModal({
  onClose,
  onAdded,
  onUpdated,
  products: productsProp,
  managers: managersProp,
  defaultOwner = '',
}: {
  onClose: () => void
  onAdded: (opp: Opportunity) => void
  onUpdated?: (opp: Opportunity) => void
  products?: string[]
  managers?: string[]
  defaultOwner?: string
}) {
  const [form, setForm] = useState({
    name: '', customer_name: '', country: '', owner: defaultOwner,
    stage: 'Discovery', product: '', status: 'On Track', close_date: '', value: '',
    currency: 'USD',
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [savedOpp, setSavedOpp] = useState<Opportunity | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'documents' | 'notes'>('details')

  useEffect(() => {
    if (defaultOwner) setForm((f) => ({ ...f, owner: f.owner || defaultOwner }))
  }, [defaultOwner])

  const canSubmit = form.name.trim() !== '' && form.customer_name.trim() !== ''

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      customer_name: form.customer_name.trim(),
      owner: form.owner || null,
      stage: form.stage,
      product: form.product || null,
      status: form.status || null,
      country: form.country || null,
      currency: form.currency || 'USD',
      close_date: form.close_date || null,
      value: form.value === '' ? null : Number(form.value),
      loss_reason: null,
      loss_description: null,
    }
    let { data, error: sbError } = await supabase.from('opportunities').insert([payload]).select()

    // If the DB doesn't have a currency column yet, retry without it
    if (sbError && sbError.message?.includes('currency')) {
      const { currency, ...payloadWithout } = payload
      const { data: data2, error: sbError2 } = await supabase.from('opportunities').insert([payloadWithout]).select()
      data = data2; sbError = sbError2 ?? null
    }

    setSaving(false)
    if (sbError) { setError(sbError.message); return }
    const newOpp = (data?.[0] ?? { id: crypto.randomUUID(), ...payload }) as Opportunity
    onAdded(newOpp)
    setSavedOpp(newOpp)
  }

  const inputCls  = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'
  const selectCls = inputCls
  const TABS = ['details', 'contacts', 'documents', 'notes'] as const

  // Placeholder shown on locked tabs before saving
  function LockedTab() {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-zinc-500">Save the opportunity first</p>
        <p className="mt-1 text-xs text-zinc-400">Fill in the Details tab and click Save, then this tab will unlock.</p>
        <button
          onClick={() => setActiveTab('details')}
          className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Go to Details
        </button>
      </div>
    )
  }

  // Once the opportunity is saved, hand off to the full edit modal so the
  // user can keep editing without closing and reopening.
  if (savedOpp) {
    return (
      <Modal
        opportunity={savedOpp}
        onClose={onClose}
        onSaved={(updated) => {
          setSavedOpp(updated)
          onUpdated?.(updated)
        }}
        products={productsProp}
        managers={managersProp}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed header ────────────────────────────────────────────────── */}
        <div className="shrink-0 rounded-t-2xl border-b border-zinc-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-lg font-bold text-zinc-900 placeholder-zinc-300 focus:border-blue-400 focus:bg-white focus:outline-none"
                placeholder="Opportunity name…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <StageBadge stage={form.stage} />
                {savedOpp && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Saved</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!savedOpp ? (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !canSubmit}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <span className="text-xs text-zinc-400">All tabs are now active</span>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          {/* Stage pills — only on details tab before saving */}
          {activeTab === 'details' && !savedOpp && (
            <div className="mt-3 flex flex-wrap gap-2">
              {STAGES.map((s) => {
                const active = form.stage === s
                const colors: Record<string, string> = {
                  Discovery:   active ? 'bg-blue-600 text-white'   : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                  Proposal:    active ? 'bg-yellow-500 text-white'  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  Negotiation: active ? 'bg-orange-500 text-white'  : 'bg-orange-50 text-orange-700 hover:bg-orange-100',
                  Win:         active ? 'bg-green-600 text-white'   : 'bg-green-50 text-green-700 hover:bg-green-100',
                  Loss:        active ? 'bg-red-600 text-white'     : 'bg-red-50 text-red-700 hover:bg-red-100',
                }
                return (
                  <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, stage: s }))}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${colors[s] ?? ''}`}>
                    {s}
                  </button>
                )
              })}
            </div>
          )}

          {/* Tab bar */}
          <div className="mt-3 flex gap-0.5 border-b border-zinc-100">
            {TABS.map((t) => {
              const locked = t !== 'details' && !savedOpp
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`relative -mb-px rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === t
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : locked
                      ? 'cursor-not-allowed text-zinc-300'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  }`}
                >
                  {t}
                  {locked && <span className="ml-1 text-[10px] opacity-60">🔒</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Details tab */}
          {activeTab === 'details' && !savedOpp && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account Name">
                <input className={inputCls} placeholder="Company or account"
                  value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
              </Field>

              <Field label="Sales Manager">
                {managersProp && managersProp.length > 0
                  ? <select className={selectCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                      <option value="">— Unassigned —</option>
                      {managersProp.map((m) => <option key={m} value={m}>{m}</option>)}
                      {form.owner && !managersProp.includes(form.owner) && (
                        <option value={form.owner}>{form.owner}</option>
                      )}
                    </select>
                  : <input className={inputCls} placeholder="Manager name" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
                }
              </Field>

              <Field label="Product">
                <SearchableSelect
                  value={form.product}
                  onChange={(v) => setForm((f) => ({ ...f, product: v }))}
                  options={productsProp ?? PRODUCTS}
                  placeholder="Search product…"
                  className={inputCls}
                />
              </Field>

              <Field label="Country">
                <SearchableSelect
                  value={form.country}
                  onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  options={COUNTRIES}
                  placeholder="Search country…"
                  className={inputCls}
                />
              </Field>

              <Field label="Close Date">
                <select className={selectCls} value={form.close_date} onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value }))}>
                  <option value="">— Select quarter —</option>
                  {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </Field>

              <Field label="Status">
                <select className={selectCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">— None —</option>
                  {['On Track', 'Risk', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Currency">
                <select className={selectCls} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Value (Forecast)">
                <NumericInput className={inputCls} placeholder="0"
                  value={form.value === '' ? null : Number(form.value)}
                  onChange={(v) => setForm((f) => ({ ...f, value: v == null ? '' : String(v) }))} />
              </Field>
            </div>
          )}

          {/* After saving — details shows the read/edit view via Modal internals */}
          {activeTab === 'details' && savedOpp && (
            <p className="text-sm text-zinc-500">
              Opportunity saved. Close this window and reopen it from the Pipeline table to edit details.
            </p>
          )}

          {activeTab === 'contacts'  && <LockedTab />}
          {activeTab === 'documents' && <LockedTab />}
          {activeTab === 'notes'     && <LockedTab />}

        </div>
      </div>
    </div>
  )
}

function toDraft(opp: Opportunity): Draft {
  return {
    name: opp.name ?? '',
    customer_name: opp.customer_name ?? '',
    owner: (opp.owner as string) ?? '',
    stage: opp.stage ?? '',
    status: (opp.status as string) ?? '',
    product: (opp.product as string) ?? '',
    country: (opp.country as string) ?? '',
    close_date: (opp as any).close_date ?? '',
    currency: (opp as any).currency ?? 'USD',
    value: opp.value,
    final_win_value: opp.stage === 'Win' ? ((opp as any).final_win_value || opp.value || null) : ((opp as any).final_win_value ?? null),
    loss_reason: opp.loss_reason ?? '',
    loss_description: opp.loss_description ?? '',
  }
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
function NotesPanel({ opportunityId }: { opportunityId: string | number }) {
  const [notes, setNotes]         = useState<Note[]>([])
  const [loading, setLoading]     = useState(true)
  const [noteText, setNoteText]   = useState('')
  const [adding, setAdding]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('notes')
      .select('id, opportunity_id, content, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setNotes((data as Note[]) ?? []); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [opportunityId])

  async function addNote() {
    if (!noteText.trim()) return
    setAdding(true); setError(null)
    const { data, error: err } = await supabase
      .from('notes')
      .insert([{ opportunity_id: opportunityId, content: noteText }])
      .select()
    setAdding(false)
    if (err) { setError(err.message); return }
    const saved: Note = data?.[0] ?? {
      id: crypto.randomUUID(),
      opportunity_id: String(opportunityId),
      content: noteText,
      created_at: new Date().toISOString(),
    }
    setNotes((prev) => [saved, ...prev])
    setNoteText('')
  }

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Notes</p>
      <div className="flex gap-2">
        <textarea
          rows={2}
          className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/20"
          placeholder="Add a note…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }}
        />
        <button
          onClick={addNote}
          disabled={adding || !noteText.trim()}
          className="self-end rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-xs text-zinc-400">Loading…</p>
        ) : notes.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-200 py-8 text-center">
            <p className="text-xs text-zinc-400">No notes yet.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-zinc-100 bg-white px-3 py-2.5 shadow-sm">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{note.content}</p>
              <span className="mt-1.5 block tabular-nums text-[11px] text-zinc-400">{formatTimestamp(note.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Contacts Panel ────────────────────────────────────────────────────────────
type Contact = {
  id: string
  opportunity_id: string
  name: string
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
  note: string | null
}

const emptyContact = { name: '', title: '', phone: '', email: '', organization: '', note: '' }

function ContactsPanel({ opportunityId }: { opportunityId: string }) {
  const [contacts, setContacts]   = useState<Contact[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState(emptyContact)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => { loadContacts() }, [opportunityId])

  async function loadContacts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('opportunity_contacts')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true })
    setLoading(false)
    if (error) { setError(error.message); return }
    setContacts((data ?? []) as Contact[])
  }

  async function saveContact() {
    if (!form.name.trim()) return
    setBusy(true); setError(null)
    const payload = {
      opportunity_id: opportunityId,
      name: form.name.trim(),
      title: form.title.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      organization: form.organization.trim() || null,
      note: form.note.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('opportunity_contacts').update(payload).eq('id', editingId)
      : await supabase.from('opportunity_contacts').insert([payload])
    setBusy(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setEditingId(null); setForm(emptyContact)
    loadContacts()
  }

  function startEdit(c: Contact) {
    setEditingId(c.id)
    setForm({ name: c.name, title: c.title ?? '', phone: c.phone ?? '', email: c.email ?? '', organization: c.organization ?? '', note: c.note ?? '' })
    setShowForm(true)
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await supabase.from('opportunity_contacts').delete().eq('id', id)
    loadContacts()
  }

  const inputCls = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyContact) }}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Contact form */}
      {showForm && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-zinc-900">{editingId ? 'Edit Contact' : 'New Contact'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Full Name *</label>
              <input className={inputCls} placeholder="e.g. John Smith" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Title / Position</label>
              <input className={inputCls} placeholder="e.g. Procurement Manager" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Organization</label>
              <input className={inputCls} placeholder="Company or department" value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Phone</label>
              <input className={inputCls} placeholder="+1 555 000 0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Email</label>
              <input type="email" className={inputCls} placeholder="contact@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Note</label>
              <input className={inputCls} placeholder="Role in deal, relationship notes…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyContact) }} className="rounded-xl border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button onClick={saveContact} disabled={busy || !form.name.trim()} className="rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? 'Saving…' : 'Save Contact'}
            </button>
          </div>
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : contacts.length === 0 && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center">
          <p className="text-sm text-zinc-400">No contacts yet.</p>
          <p className="mt-1 text-xs text-zinc-300">Click Add Contact to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-100 bg-white px-4 py-3 transition-all duration-150 hover:border-zinc-200 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-900">{c.name}</p>
                    {c.title && <span className="text-xs text-zinc-500">{c.title}</span>}
                    {c.organization && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{c.organization}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {c.email}
                      </a>
                    )}
                  </div>
                  {c.note && <p className="mt-1.5 text-xs text-zinc-500 italic">{c.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => startEdit(c)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Edit</button>
                  <button onClick={() => deleteContact(c.id)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Documents Panel ───────────────────────────────────────────────────────────
const BUCKET = 'opportunity-docs'

type DocFile = { name: string; updated_at: string; metadata?: { size?: number } }

function DocumentsPanel({ opportunityId }: { opportunityId: string }) {
  const [files, setFiles]       = useState<DocFile[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  const folder = `${opportunityId}/`

  useEffect(() => { loadFiles() }, [opportunityId])

  async function loadFiles() {
    setLoading(true)
    const { data, error } = await supabase.storage.from(BUCKET).list(opportunityId)
    setLoading(false)
    if (error) { setError(error.message); return }
    setFiles((data ?? []) as DocFile[])
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const path = `${folder}${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file)
    setUploading(false)
    if (error) { setError(error.message); return }
    loadFiles()
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDownload(name: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${folder}${name}`, 60)
    if (error) { setError(error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.storage.from(BUCKET).remove([`${folder}${name}`])
    if (error) { setError(error.message); return }
    loadFiles()
  }

  function fmtSize(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function fileIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase()
    if (['pdf'].includes(ext ?? '')) return '📄'
    if (['doc', 'docx'].includes(ext ?? '')) return '📝'
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
    if (['ppt', 'pptx'].includes(ext ?? '')) return '📋'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return '🖼️'
    if (['zip', 'rar', '7z'].includes(ext ?? '')) return '🗜️'
    return '📎'
  }

  // Strip the timestamp prefix added on upload
  function displayName(name: string) {
    return name.replace(/^\d+_/, '')
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
        <span className="text-xs text-zinc-400">PDF, Word, Excel, images and more</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* File list */}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : files.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center">
          <p className="text-sm text-zinc-400">No documents attached yet.</p>
          <p className="mt-1 text-xs text-zinc-300">Click Upload Document to add files.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-100 bg-white overflow-hidden">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-3 border-b border-zinc-50 px-4 py-3 last:border-0 hover:bg-zinc-50 transition-colors">
              <span className="text-xl">{fileIcon(f.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">{displayName(f.name)}</p>
                <p className="text-xs text-zinc-400">
                  {fmtSize(f.metadata?.size)}
                  {f.updated_at && ` · ${new Date(f.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(f.name)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(f.name)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-36 shrink-0 text-sm font-medium text-zinc-500">{label}</dt>
      <dd className="flex-1 text-sm text-zinc-800">{value}</dd>
    </div>
  )
}

// ── Searchable combo-box ──────────────────────────────────────────────────────
// Generic reusable component for any option list.
// Uses position:fixed for the dropdown so it escapes the modal's overflow-y-auto.
function SearchableSelect({
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Search…',
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  className?: string
  placeholder?: string
}) {
  const [query, setQuery]   = useState(value)
  const [open, setOpen]     = useState(false)
  const [rect, setRect]     = useState<DOMRect | null>(null)
  const inputRef            = useRef<HTMLInputElement>(null)
  const listRef             = useRef<HTMLUListElement>(null)

  // Keep the visible query in sync when the parent resets the value.
  useEffect(() => { setQuery(value) }, [value])

  // Re-measure the input position while the dropdown is open so it tracks
  // scrolling inside the modal.
  useEffect(() => {
    if (!open) return
    function update() {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Close on outside click and revert query to the last confirmed value.
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (
        !inputRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, value])

  const filtered = query.trim()
    ? options.filter((c) => c.toLowerCase().includes(query.toLowerCase().trim()))
    : options

  function select(country: string) {
    onChange(country)
    setQuery(country)
    setOpen(false)
  }

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          className={className}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => {
            if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery(value) }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length === 1) select(filtered[0])
            }
          }}
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); select('') }}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && rect && filtered.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'fixed',
            top:   rect.bottom + 4,
            left:  rect.left,
            width: rect.width,
            zIndex: 9999,
          }}
          className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {filtered.map((c) => (
            <li
              key={c}
              onMouseDown={(e) => { e.preventDefault(); select(c) }}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                c === value
                  ? 'bg-blue-50 font-semibold text-blue-700'
                  : 'text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="text-sm text-zinc-900">{children}</div>
    </div>
  )
}

const stageColors: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  win: 'bg-green-100 text-green-700',
  loss: 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  'on track': 'bg-green-100 text-green-700',
  'risk':     'bg-yellow-100 text-yellow-700',
  'critical': 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: string }) {
  const key   = (status ?? '').toLowerCase()
  const color = statusColors[key] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status ?? '—'}
    </span>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const key = (stage ?? '').toLowerCase()
  const color = stageColors[key] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {stage ?? '—'}
    </span>
  )
}

const _usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

function formatCurrency(value: number, currency = 'USD') {
  return _usdFmt.format(toUSD(value, currency))
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

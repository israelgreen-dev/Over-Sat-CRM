'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  product_lines: ProductLine[]
  country: string
  opportunity_type: string
  website: string
  source: string
  priority: string
  currency: string
  value: number | null
  close_date: string
  final_win_value: number | null
  loss_reason: string
  loss_description: string
  probability: number | null
  quarterly_incomes: Record<string, number>
}

// Default probability by stage (used when probability is not explicitly set).
// These are the factory values — the admin can override them in Settings,
// in which case the overrides are passed down as the `defaults` argument.
export const DEFAULT_PROBABILITY: Record<string, number> = {
  Discovery: 10, Proposal: 25, Negotiation: 60, Win: 100, Loss: 0,
}

export function effectiveProbability(o: Opportunity, defaults: Record<string, number> = DEFAULT_PROBABILITY): number {
  const p = (o as any).probability
  if (p !== null && p !== undefined) return Number(p)
  return defaults[o.stage] ?? 0
}

export function weightedValue(o: Opportunity, defaults: Record<string, number> = DEFAULT_PROBABILITY): number {
  return ((o.value ?? 0) * effectiveProbability(o, defaults)) / 100
}

// ── Product line items ──────────────────────────────────────────────────────
// An opportunity can consist of several products, each with its own quantity
// and unit price. The opportunity's `value` stays the sum of the line totals.
export type ProductLine = { id: string; product: string; quantity: number; price: number }

export function newProductLine(product = '', price = 0, quantity = 1): ProductLine {
  return { id: Math.random().toString(36).slice(2), product, quantity: Math.max(1, quantity), price: Math.max(0, price) }
}
export function lineTotal(l: ProductLine): number { return (l.price || 0) * (l.quantity || 0) }
export function linesTotal(lines: ProductLine[]): number { return lines.reduce((s, l) => s + lineTotal(l), 0) }

// Read product lines off an opportunity, synthesizing a single line from the
// legacy `product` + `value` for opportunities saved before multi-product.
export function getProductLines(opp: Opportunity): ProductLine[] {
  const raw = (opp as any).product_lines
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((l: any) => newProductLine(l.product ?? '', Number(l.price) || 0, Number(l.quantity) || 1))
  }
  const p = (opp.product as string) ?? ''
  return p ? [newProductLine(p, Number(opp.value) || 0, 1)] : []
}
export function productSummary(lines: ProductLine[]): string {
  return lines.map((l) => l.product).filter(Boolean).join(', ')
}

type Note = {
  id: string
  opportunity_id: string
  content: string
  created_at: string
}

const STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']

export function generateQuarters(count = 8): string[] {
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

// Generate `count` quarters starting from a "Qn-YYYY" string (e.g. the deal's
// close date). Falls back to the current-quarter window when no/invalid start.
export function generateQuartersFrom(start: string | null | undefined, count = 8): string[] {
  const m = String(start ?? '').match(/Q([1-4])-(\d{4})/)
  if (!m) return generateQuarters(count)
  let q = Number(m[1]), y = Number(m[2])
  const quarters: string[] = []
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

// What kind of buyer the deal is with — set on the lead and carried over on
// conversion; editable on the opportunity itself.
export const OPPORTUNITY_TYPES = [
  'Direct Customer', 'Partner', 'Distributor', 'Integrator',
  'Government', 'Military', 'Law Enforcement',
] as const

// Shared by leads and opportunities so both entry paths capture equal data.
export const LEAD_SOURCES = [
  'Website', 'Exhibition', 'Partner', 'Referral', 'LinkedIn',
  'Cold Outreach', 'Existing Customer', 'Distributor', 'Other',
] as const

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export const PRIORITY_ICONS: Record<string, string> = { High: '🔴', Medium: '🟡', Low: '🟢' }

export const COUNTRIES = [
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
  step = 1,
  min = 0,
  max,
}: {
  value: number | null
  onChange: (v: number | null) => void
  className?: string
  placeholder?: string
  step?: number
  min?: number
  max?: number
}) {
  function toDisplay(n: number | null) {
    if (n == null || isNaN(n)) return ''
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const [display, setDisplay] = useState(() => toDisplay(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDisplay(toDisplay(value))
  }, [value, focused])

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

  function bump(delta: number) {
    let next = (value ?? 0) + delta
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    onChange(next)
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="numeric"
        className={`${className ?? ''} pr-6`}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {/* Up / down steppers */}
      <div className="absolute inset-y-0 right-0 flex w-5 flex-col overflow-hidden rounded-r-lg border-l border-zinc-200/70">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); bump(step) }}
          title="Increase"
          className="flex flex-1 items-center justify-center bg-zinc-50/80 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); bump(-step) }}
          title="Decrease"
          className="flex flex-1 items-center justify-center border-t border-zinc-200/70 bg-zinc-50/80 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    </div>
  )
}

// ── Resizable, draggable-corner dialog frame ───────────────────────────────────
// Shared by the add and edit opportunity modals. Starts at a sensible default
// size and can be resized by dragging any of the four corners.
function ResizableDialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  // Escape closes the dialog (callers pass a guarded close that warns about
  // unsaved changes). Backdrop clicks intentionally do NOT close it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Esc inside a field cancels that field (search dropdowns etc.),
      // not the whole dialog.
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function startResize(e: React.PointerEvent, corner: 'nw' | 'ne' | 'sw' | 'se') {
    e.preventDefault()
    e.stopPropagation()
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX, startY = e.clientY
    const startW = rect.width, startH = rect.height
    const signX = corner.includes('e') ? 1 : -1
    const signY = corner.includes('s') ? 1 : -1
    const maxW = window.innerWidth - 24
    const maxH = window.innerHeight - 24

    function onMove(ev: PointerEvent) {
      // The panel is centre-anchored, so it grows by twice the cursor delta to
      // keep the dragged corner under the pointer.
      const w = Math.min(maxW, Math.max(380, startW + signX * (ev.clientX - startX) * 2))
      const h = Math.min(maxH, Math.max(340, startH + signY * (ev.clientY - startY) * 2))
      setSize({ w, h })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handles: { corner: 'nw' | 'ne' | 'sw' | 'se'; cls: string; cursor: string }[] = [
    { corner: 'nw', cls: 'top-0 left-0',     cursor: 'nwse-resize' },
    { corner: 'ne', cls: 'top-0 right-0',    cursor: 'nesw-resize' },
    { corner: 'sw', cls: 'bottom-0 left-0',  cursor: 'nesw-resize' },
    { corner: 'se', cls: 'bottom-0 right-0', cursor: 'nwse-resize' },
  ]

  return (
    // Deliberately NOT closing on backdrop click: this dialog holds data
    // entry, and a stray click outside must never dismiss the user's work.
    // Closing happens only via the explicit ✕ / Save buttons (guarded).
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panelRef}
        className={`relative flex w-full flex-col rounded-2xl bg-white shadow-2xl ${size ? '' : 'max-w-3xl'}`}
        style={size ? { width: size.w, height: size.h } : { height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        {handles.map(({ corner, cls, cursor }) => (
          <div
            key={corner}
            onPointerDown={(e) => startResize(e, corner)}
            title="Drag to resize"
            className={`absolute ${cls} z-20 h-4 w-4`}
            style={{ cursor }}
          >
            {corner === 'se' && (
              <svg className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-zinc-300" viewBox="0 0 10 10" fill="currentColor">
                <path d="M9 1v8H1z" opacity="0.5" />
                <path d="M9 4v5H4z" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Modal({
  opportunity,
  onClose,
  onSaved,
  onDeleted,
  canDelete,
  products: productsProp,
  managers: managersProp,
  probabilityDefaults = DEFAULT_PROBABILITY,
}: {
  opportunity: Opportunity
  onClose: () => void
  onSaved: (updated: Opportunity) => void
  onDeleted?: () => void
  canDelete?: boolean
  products?: string[]
  managers?: string[]
  probabilityDefaults?: Record<string, number>
}) {
  const [modalTab, setModalTab] = useState<'details' | 'notes' | 'documents' | 'contacts' | 'history'>('details')
  const [draft, setDraft]       = useState<Draft>(toDraft(opportunity))
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Quarterly income entry mode: absolute amounts or % of the deal value.
  // Amounts remain the stored source of truth either way.
  const [qiMode, setQiMode]     = useState<'amount' | 'percent'>('amount')

  // Snapshot of the loaded draft — used to warn before discarding edits.
  // Product-line ids are regenerated randomly on every load (newProductLine),
  // so they must be excluded from the comparison — otherwise an untouched
  // deal would always look dirty.
  function draftSignature(d: Draft): string {
    return JSON.stringify({
      ...d,
      product_lines: d.product_lines.map(({ product, quantity, price }) => ({ product, quantity, price })),
    })
  }
  const initialDraft = useRef(draftSignature(toDraft(opportunity)))
  const isDirty = draftSignature(draft) !== initialDraft.current

  function guardedClose() {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return
    onClose()
  }

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

  // Returns true on success, false on failure.
  // Using a return value instead of reading saveError state avoids
  // the stale-closure bug (state updates are async, the old value
  // would be read before React re-renders).
  async function save(): Promise<boolean> {
    setSaving(true)
    setSaveError(null)

    // Products are the source of truth for the deal value and product label.
    const cleanLines  = draft.product_lines.filter((l) => l.product || l.price || l.quantity > 1)
    const dealValue   = cleanLines.length > 0 ? linesTotal(cleanLines) : draft.value
    const finalWinValue = isWon ? (draft.final_win_value || dealValue) : null

    const base = {
      name:              draft.name,
      customer_name:     draft.customer_name,
      owner:             draft.owner || null,
      stage:             draft.stage,
      status:            draft.status || null,
      product:           (cleanLines.length > 0 ? productSummary(cleanLines) : draft.product) || null,
      product_lines:     cleanLines,
      country:           draft.country || null,
      opportunity_type:  draft.opportunity_type || null,
      website:           draft.website.trim() || null,
      source:            draft.source || null,
      priority:          draft.priority || null,
      currency:          draft.currency || 'USD',
      close_date:        draft.close_date || null,
      value:             dealValue,
      final_win_value:   finalWinValue,
      loss_reason:       isLost ? draft.loss_reason : null,
      loss_description:  isLost ? draft.loss_description : null,
      probability:       draft.probability,
      quarterly_incomes: draft.quarterly_incomes,
      // The DB trigger (migration 008) overwrites this with server time; the
      // client value just keeps the local state fresh right after saving.
      updated_at:        new Date().toISOString(),
    }

    // Progressive fallback: strip columns that don't exist in older DB schemas.
    const payload: Record<string, unknown> = { ...base }
    let sbError: { message: string } | null = null

    for (let attempt = 0; attempt < 11; attempt++) {
      const { error } = await supabase.from('opportunities').update(payload).eq('id', opportunity.id)
      sbError = error
      if (!error) break
      if (error.message?.includes('opportunity_type'))  { delete payload.opportunity_type;  continue }
      if (error.message?.includes('website'))           { delete payload.website;           continue }
      if (error.message?.includes('source'))            { delete payload.source;            continue }
      if (error.message?.includes('priority'))          { delete payload.priority;          continue }
      if (error.message?.includes('updated_at'))        { delete payload.updated_at;        continue }
      if (error.message?.includes('product_lines'))     { delete payload.product_lines;     continue }
      if (error.message?.includes('quarterly_incomes')) { delete payload.quarterly_incomes; continue }
      if (error.message?.includes('probability'))       { delete payload.probability;       continue }
      if (error.message?.includes('final_win_value'))   { delete payload.final_win_value;   continue }
      if (error.message?.includes('currency'))          { delete payload.currency;          continue }
      break
    }

    setSaving(false)
    if (sbError) { setSaveError(sbError.message); return false }
    onSaved({ ...opportunity, ...payload })
    return true
  }

  async function saveAndClose() {
    const ok = await save()
    if (ok) onClose()
  }

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
    <ResizableDialog onClose={guardedClose}>
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
                  <span className="text-xs text-zinc-400" title="Created">Created {formatTimestamp((opportunity as any).created_at)}</span>
                )}
                {(opportunity as any).updated_at && (opportunity as any).updated_at !== (opportunity as any).created_at && (
                  <span className="text-xs text-zinc-400" title="Last updated">· Updated {formatTimestamp((opportunity as any).updated_at)}</span>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  title="Delete opportunity"
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
                onClick={guardedClose}
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
            {(['details', 'contacts', 'documents', 'notes', 'history'] as const).map((t) => (
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

                <Field label="Country">
                  <SearchableSelect
                    value={draft.country}
                    onChange={(v) => setDraft((d) => ({ ...d, country: v }))}
                    options={COUNTRIES}
                    placeholder="Search country…"
                    className={inputCls}
                  />
                </Field>

                <Field label="Opportunity Type">
                  <select className={selectCls} value={draft.opportunity_type} onChange={(e) => setDraft((d) => ({ ...d, opportunity_type: e.target.value }))}>
                    <option value="">— Select type —</option>
                    {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>

                <Field label="Website">
                  <input type="url" className={inputCls} placeholder="https://company.com"
                    value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} />
                </Field>

                <Field label="Lead Source">
                  <select className={selectCls} value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}>
                    <option value="">— Select source —</option>
                    {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <Field label="Priority">
                  <select className={selectCls} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_ICONS[p]} {p}</option>)}
                  </select>
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
                  <div className={`${inputCls} flex items-center justify-between bg-zinc-100`} title="Sum of the product lines below">
                    <span className="font-semibold text-zinc-800">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: draft.currency || 'USD', maximumFractionDigits: 0 }).format(draft.value ?? 0)}
                    </span>
                    <span className="text-[11px] text-zinc-400">= Σ products</span>
                  </div>
                </Field>

                <Field label="Probability %">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={`${inputCls} w-24`}
                      placeholder={String(probabilityDefaults[draft.stage] ?? 0)}
                      value={draft.probability ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                        setDraft((d) => ({ ...d, probability: v }))
                      }}
                    />
                    <span className="text-xs text-gray-400">
                      {draft.probability === null
                        ? `Default: ${probabilityDefaults[draft.stage] ?? 0}% (by stage)`
                        : `Weighted: ${draft.value ? `$${Math.round((draft.value * (draft.probability ?? 0)) / 100).toLocaleString()}` : '—'}`}
                    </span>
                  </div>
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

              {/* ── Products that make up the opportunity ───────────────── */}
              <ProductLinesEditor
                lines={draft.product_lines}
                onChange={(lines) => setDraft((d) => ({ ...d, product_lines: lines, value: linesTotal(lines), product: productSummary(lines) }))}
                products={productsProp ?? PRODUCTS}
                currency={draft.currency}
                inputCls={inputCls}
              />

              {/* ── Planned income by quarter (drives the Projection tab) ── */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Planned Income by Quarter
                    </p>
                    {/* $ / % entry mode toggle */}
                    <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      {(['amount', 'percent'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setQiMode(mode)}
                          disabled={mode === 'percent' && !draft.value}
                          title={mode === 'percent' && !draft.value ? 'Set a deal Value first to use %' : undefined}
                          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                            qiMode === mode
                              ? 'bg-indigo-600 text-white'
                              : 'text-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40'
                          }`}
                        >
                          {mode === 'amount' ? '$' : '%'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <QuarterlyAllocationSummary
                    quarterlyIncomes={draft.quarterly_incomes}
                    dealValue={draft.value}
                  />
                </div>
                <AllocationBar
                  quarterlyIncomes={draft.quarterly_incomes}
                  dealValue={draft.value}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {generateQuartersFrom(draft.close_date).map((q) => (
                    <div key={q}>
                      <p className="mb-1 text-[11px] font-semibold text-zinc-400">{q}</p>
                      {qiMode === 'amount' ? (
                        <NumericInput
                          className={inputCls}
                          placeholder="0"
                          value={draft.quarterly_incomes[q] ?? null}
                          onChange={(v) => setDraft((d) => {
                            const qi = { ...d.quarterly_incomes }
                            if (v == null) delete qi[q]
                            else qi[q] = clampToRemaining(v, d, q)
                            return { ...d, quarterly_incomes: qi }
                          })}
                        />
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              className={`${inputCls} pr-7`}
                              placeholder="0"
                              value={pctOfValue(draft.quarterly_incomes[q], draft.value)}
                              onChange={(e) => setDraft((d) => {
                                const qi = { ...d.quarterly_incomes }
                                if (e.target.value === '') {
                                  delete qi[q]
                                } else {
                                  const pct = Math.min(100, Math.max(0, Number(e.target.value)))
                                  qi[q] = clampToRemaining(Math.round(((d.value ?? 0) * pct) / 100), d, q)
                                }
                                return { ...d, quarterly_incomes: qi }
                              })}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-zinc-400">%</span>
                          </div>
                          {/* Resulting amount out of the deal value */}
                          <p className={`mt-1 text-[11px] tabular-nums ${draft.quarterly_incomes[q] ? 'font-semibold text-indigo-600' : 'text-zinc-300'}`}>
                            = ${(draft.quarterly_incomes[q] ?? 0).toLocaleString('en-US')}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
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
          {modalTab === 'history'   && <HistoryPanel   opportunityId={String(opportunity.id)} />}

        </div>
    </ResizableDialog>
  )
}

export function AddOpportunityModal({
  onClose,
  onAdded,
  products: productsProp,
  managers: managersProp,
  defaultOwner = '',
  probabilityDefaults = DEFAULT_PROBABILITY,
  existingAccounts = [],
}: {
  onClose: () => void
  onAdded: (opp: Opportunity) => void
  /** @deprecated kept for call-site compatibility; the add flow saves and closes in one step. */
  onUpdated?: (opp: Opportunity) => void
  products?: string[]
  managers?: string[]
  defaultOwner?: string
  probabilityDefaults?: Record<string, number>
  /** Account names already present in the pipeline — used to warn about duplicates. */
  existingAccounts?: string[]
}) {
  const [form, setForm] = useState({
    name: '', customer_name: '', website: '', country: '', owner: defaultOwner,
    stage: 'Discovery', product: '', status: 'On Track', close_date: '', value: '',
    currency: 'USD', probability: null as number | null, opportunity_type: '',
    source: '', priority: 'Medium',
    contact_name: '', contact_title: '', contact_email: '', contact_phone: '', contact_linkedin: '',
    product_lines: [] as ProductLine[],
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (defaultOwner) setForm((f) => ({ ...f, owner: f.owner || defaultOwner }))
  }, [defaultOwner])

  const canSubmit = form.name.trim() !== '' && form.customer_name.trim() !== ''

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const cleanLines = form.product_lines.filter((l) => l.product || l.price || l.quantity > 1)
    const dealValue  = cleanLines.length > 0 ? linesTotal(cleanLines) : (form.value === '' ? null : Number(form.value))

    const base = {
      name:             form.name.trim(),
      customer_name:    form.customer_name.trim(),
      owner:            form.owner || null,
      stage:            form.stage,
      product:          (cleanLines.length > 0 ? productSummary(cleanLines) : form.product) || null,
      product_lines:    cleanLines,
      status:           form.status || null,
      country:          form.country || null,
      opportunity_type: form.opportunity_type || null,
      website:          form.website.trim() || null,
      source:           form.source || null,
      priority:         form.priority || null,
      currency:         form.currency || 'USD',
      close_date:       form.close_date || null,
      value:            dealValue,
      probability:      form.probability,
      loss_reason:      null,
      loss_description: null,
    }

    // Progressive fallback: strip columns that don't exist in older DB schemas.
    const payload: Record<string, unknown> = { ...base }
    let data: any[] | null = null
    let sbError: { message: string } | null = null

    for (let attempt = 0; attempt < 9; attempt++) {
      const res = await supabase.from('opportunities').insert([payload]).select()
      data = res.data; sbError = res.error
      if (!res.error) break
      // Strip unsupported columns one at a time and retry.
      // Note: final_win_value is not sent on INSERT so that branch is omitted here.
      if (res.error.message?.includes('opportunity_type')) { delete payload.opportunity_type; continue }
      if (res.error.message?.includes('website'))           { delete payload.website;          continue }
      if (res.error.message?.includes('source'))            { delete payload.source;           continue }
      if (res.error.message?.includes('priority'))          { delete payload.priority;         continue }
      if (res.error.message?.includes('product_lines'))     { delete payload.product_lines;    continue }
      if (res.error.message?.includes('probability'))       { delete payload.probability;      continue }
      if (res.error.message?.includes('currency'))          { delete payload.currency;         continue }
      break
    }

    setSaving(false)
    if (sbError) { setError(sbError.message); return }
    const newOpp = (data?.[0] ?? { id: crypto.randomUUID(), ...payload }) as Opportunity

    // Save the contact into the opportunity's Contacts tab (best-effort).
    if (form.contact_name.trim() || form.contact_email.trim()) {
      await supabase.from('opportunity_contacts').insert([{
        opportunity_id: String(newOpp.id),
        name:  form.contact_name.trim() || '—',
        title: form.contact_title.trim() || null,
        email: form.contact_email.trim() || null,
        phone: form.contact_phone.trim() || null,
        organization: form.customer_name.trim() || null,
        note:  form.contact_linkedin.trim() ? `LinkedIn: ${form.contact_linkedin.trim()}` : null,
      }])
    }

    onAdded(newOpp)
    onClose()
  }

  const inputCls  = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'
  const selectCls = inputCls

  // Warn before closing if the user has started filling in the form.
  const formDirty = form.name.trim() !== '' || form.customer_name.trim() !== '' || form.product_lines.length > 0
  function guardedClose() {
    if (formDirty && !confirm('Discard this new opportunity?')) return
    onClose()
  }

  return (
    <ResizableDialog onClose={guardedClose}>
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
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={saving || !canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save Opportunity'}
              </button>
              <button
                onClick={guardedClose}
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

          {/* Stage pills */}
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
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
              <Field label="Company Name">
                <input className={inputCls} placeholder="Company or account"
                  value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
                {(() => {
                  const q = form.customer_name.trim().toLowerCase()
                  if (!q) return null
                  const dupes = existingAccounts.filter((a) => a?.trim().toLowerCase() === q).length
                  if (dupes === 0) return null
                  return (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      {dupes} deal{dupes !== 1 ? 's' : ''} already exist{dupes === 1 ? 's' : ''} for this account — check Opportunities before creating a duplicate.
                    </p>
                  )
                })()}
              </Field>

              <Field label="Website">
                <input type="url" className={inputCls} placeholder="https://company.com"
                  value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </Field>

              {/* ── Contact Information ─────────────────────────────────── */}
              <p className="col-span-2 mt-1 border-b border-zinc-100 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Contact Information</p>

              <Field label="Contact Name">
                <input className={inputCls} placeholder="Full name"
                  value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </Field>

              <Field label="Job Title">
                <input className={inputCls} placeholder="e.g. VP Engineering"
                  value={form.contact_title} onChange={(e) => setForm((f) => ({ ...f, contact_title: e.target.value }))} />
              </Field>

              <Field label="Email">
                <input type="email" className={inputCls} placeholder="name@company.com"
                  value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </Field>

              <Field label="Mobile Phone">
                <input className={inputCls} placeholder="+972…"
                  value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </Field>

              <div className="col-span-2">
                <Field label="LinkedIn Profile">
                  <input type="url" className={inputCls} placeholder="https://linkedin.com/in/…"
                    value={form.contact_linkedin} onChange={(e) => setForm((f) => ({ ...f, contact_linkedin: e.target.value }))} />
                </Field>
              </div>

              {/* ── Deal Details ────────────────────────────────────────── */}
              <p className="col-span-2 mt-1 border-b border-zinc-100 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Deal Details</p>

              <Field label="Country">
                <SearchableSelect
                  value={form.country}
                  onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  options={COUNTRIES}
                  placeholder="Search country…"
                  className={inputCls}
                />
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

              <Field label="Lead Source">
                <select className={selectCls} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">— Select source —</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Opportunity Type">
                <select className={selectCls} value={form.opportunity_type} onChange={(e) => setForm((f) => ({ ...f, opportunity_type: e.target.value }))}>
                  <option value="">— Select type —</option>
                  {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Priority">
                <select className={selectCls} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_ICONS[p]} {p}</option>)}
                </select>
              </Field>

              {/* spacer so the deal-financials area below starts on its own row */}
              <div />

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
                <div className={`${inputCls} flex items-center justify-between bg-zinc-100`} title="Sum of the product lines below">
                  <span className="font-semibold text-zinc-800">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.currency || 'USD', maximumFractionDigits: 0 }).format(linesTotal(form.product_lines))}
                  </span>
                  <span className="text-[11px] text-zinc-400">= Σ products</span>
                </div>
              </Field>

              <Field label="Probability %">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="100"
                    className={`${inputCls} w-24`}
                    placeholder={String(probabilityDefaults[form.stage] ?? 0)}
                    value={form.probability ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                      setForm((f) => ({ ...f, probability: v }))
                    }}
                  />
                  <span className="text-xs text-gray-400">
                    Default: {probabilityDefaults[form.stage] ?? 0}% by stage
                  </span>
                </div>
              </Field>

              {/* ── Products that make up the opportunity ───────────────── */}
              <ProductLinesEditor
                lines={form.product_lines}
                onChange={(lines) => setForm((f) => ({ ...f, product_lines: lines }))}
                products={productsProp ?? PRODUCTS}
                currency={form.currency}
                inputCls={inputCls}
              />

              <p className="col-span-2 text-xs text-zinc-400">
                Contacts, documents and notes can be added after saving — reopen the opportunity from the Opportunities tab.
              </p>
          </div>

        </div>
    </ResizableDialog>
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
    product_lines: getProductLines(opp),
    country: (opp.country as string) ?? '',
    opportunity_type: ((opp as any).opportunity_type as string) ?? '',
    website: ((opp as any).website as string) ?? '',
    source: ((opp as any).source as string) ?? '',
    priority: ((opp as any).priority as string) ?? 'Medium',
    close_date: (opp as any).close_date ?? '',
    currency: (opp as any).currency ?? 'USD',
    value: opp.value,
    final_win_value: opp.stage === 'Win' ? ((opp as any).final_win_value || opp.value || null) : ((opp as any).final_win_value ?? null),
    loss_reason: opp.loss_reason ?? '',
    loss_description: opp.loss_description ?? '',
    probability: (opp as any).probability ?? null,
    quarterly_incomes: ((opp as any).quarterly_incomes as Record<string, number>) ?? {},
  }
}

// ── Product lines editor ──────────────────────────────────────────────────────
// Used by both the add and edit modals. Each row is a product with its own
// quantity and unit price; the footer shows the opportunity total.
function ProductLinesEditor({
  lines,
  onChange,
  products,
  currency,
  inputCls,
}: {
  lines: ProductLine[]
  onChange: (lines: ProductLine[]) => void
  products: string[]
  currency: string
  inputCls: string
}) {
  const cfmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n)

  function update(id: string, patch: Partial<ProductLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  return (
    <div className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Products</p>
        <span className="text-xs text-zinc-400">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
      </div>

      {lines.length > 0 && (
        <div className="mb-1 grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <div className="col-span-4">Product</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-3 text-center">Unit Price</div>
          <div className="col-span-3 text-right">Line Total</div>
        </div>
      )}

      <div className="space-y-2">
        {lines.length === 0 && (
          <p className="rounded-lg bg-white px-3 py-3 text-center text-xs text-zinc-400">
            No products yet — add one below.
          </p>
        )}
        {lines.map((l) => (
          <div key={l.id} className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4">
              <SearchableSelect
                value={l.product}
                onChange={(v) => update(l.id, { product: v })}
                options={products}
                placeholder="Product…"
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <NumericInput className={`${inputCls} text-center`} placeholder="1" value={l.quantity} min={1} onChange={(v) => update(l.id, { quantity: Math.max(1, v ?? 1) })} />
            </div>
            <div className="col-span-3">
              <NumericInput className={inputCls} placeholder="0" value={l.price} onChange={(v) => update(l.id, { price: Math.max(0, v ?? 0) })} />
            </div>
            <div className="col-span-3 flex items-center justify-end gap-1.5">
              <span className="whitespace-nowrap text-sm font-semibold text-zinc-700" title="Line total">{cfmt(lineTotal(l))}</span>
              <button
                type="button"
                onClick={() => onChange(lines.filter((x) => x.id !== l.id))}
                title="Delete product"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-2">
        <button
          type="button"
          onClick={() => onChange([...lines, newProductLine()])}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          + Add product
        </button>
        <span className="text-sm font-bold text-zinc-900">Total: {cfmt(linesTotal(lines))}</span>
      </div>
    </div>
  )
}

// ── History Panel ─────────────────────────────────────────────────────────────
// Read-only audit trail (populated by the DB trigger from migration 009).
type AuditEntry = {
  id: number
  action: string
  changed_by: string | null
  changed_at: string
  changes: Record<string, { old: unknown; new: unknown }>
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', customer_name: 'Account', owner: 'Sales Manager', stage: 'Stage',
  status: 'Status', product: 'Product', country: 'Country', currency: 'Currency',
  close_date: 'Close Date', value: 'Value', final_win_value: 'Win Value',
  probability: 'Probability %', loss_reason: 'Loss Reason', loss_description: 'Loss Description',
}

function fmtAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('en-US')
  return String(v)
}

function HistoryPanel({ opportunityId }: { opportunityId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('opportunity_audit')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('changed_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setEntries((data ?? []) as AuditEntry[])
        setLoading(false)
      })
  }, [opportunityId])

  if (loading) return <p className="py-8 text-center text-sm text-zinc-400">Loading history…</p>
  if (error) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400">
        History is not available yet{error.includes('does not exist') || error.includes('schema cache') ? ' — run migration 009 in Supabase to enable the audit trail.' : `: ${error}`}
      </p>
    )
  }
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">No changes recorded yet. Edits made from now on appear here automatically.</p>
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${
              e.action === 'INSERT' ? 'bg-green-100 text-green-700'
              : e.action === 'DELETE' ? 'bg-red-100 text-red-600'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {e.action === 'INSERT' ? 'Created' : e.action === 'DELETE' ? 'Deleted' : 'Updated'}
            </span>
            <span className="font-medium text-zinc-600">{e.changed_by || 'Unknown'}</span>
            <span>·</span>
            <span className="tabular-nums">{formatTimestamp(e.changed_at)}</span>
          </div>
          {e.action === 'UPDATE' && (
            <ul className="space-y-1">
              {Object.entries(e.changes ?? {}).map(([field, ch]) => (
                <li key={field} className="text-sm text-zinc-700">
                  <span className="font-semibold">{FIELD_LABELS[field] ?? field}:</span>{' '}
                  <span className="text-zinc-400 line-through">{fmtAuditValue(ch?.old)}</span>
                  {' → '}
                  <span className="font-medium text-zinc-900">{fmtAuditValue(ch?.new)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
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
                  <button onClick={() => deleteContact(c.id)} title="Delete contact" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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
                  title="Delete document"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The stored quarterly amount expressed as a % of the deal value, for the
// percent entry mode. Returns '' for empty so the input shows its placeholder.
function pctOfValue(amount: number | undefined, dealValue: number | null): string {
  if (amount == null || !dealValue) return ''
  return String(Math.round((amount / dealValue) * 1000) / 10)
}

// Caps a quarter's amount so the total allocation never exceeds the deal value.
// Without a deal value there is nothing to cap against.
function clampToRemaining(requested: number, draft: Draft, quarter: string): number {
  if (draft.value == null) return requested
  const allocatedToOthers = Object.entries(draft.quarterly_incomes)
    .filter(([q]) => q !== quarter)
    .reduce((s, [, n]) => s + (n || 0), 0)
  return Math.max(0, Math.min(requested, draft.value - allocatedToOthers))
}

// Visual allocation gauge: indigo while under-allocated, green at exactly
// 100%, red when legacy data exceeds the (possibly lowered) deal value.
function AllocationBar({
  quarterlyIncomes,
  dealValue,
}: {
  quarterlyIncomes: Record<string, number>
  dealValue: number | null
}) {
  if (!dealValue) return null
  const allocated = Object.values(quarterlyIncomes).reduce((s, n) => s + (n || 0), 0)
  const pct  = (allocated / dealValue) * 100
  const over = pct > 100.5
  const full = !over && pct > 99.5
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/70">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: over ? '#ef4444' : full ? '#10b981' : '#6366f1',
          }}
        />
      </div>
      <span
        className={`w-12 shrink-0 text-right text-[11px] font-bold tabular-nums ${
          over ? 'text-red-500' : full ? 'text-emerald-600' : 'text-indigo-600'
        }`}
      >
        {Math.round(pct)}%
      </span>
    </div>
  )
}

// Shows how much of the deal value has been spread across quarters,
// turning amber when the allocation doesn't match the deal value.
function QuarterlyAllocationSummary({
  quarterlyIncomes,
  dealValue,
}: {
  quarterlyIncomes: Record<string, number>
  dealValue: number | null
}) {
  const allocated = Object.values(quarterlyIncomes).reduce((s, n) => s + (n || 0), 0)
  if (allocated === 0) {
    return <span className="text-xs text-zinc-400">Spread the deal value over the quarters below</span>
  }
  const matches = dealValue == null || allocated === dealValue
  const pct     = dealValue ? Math.round((allocated / dealValue) * 100) : null
  return (
    <span className={`text-xs font-medium ${matches ? 'text-zinc-500' : 'text-amber-600'}`}>
      Allocated: ${allocated.toLocaleString('en-US')}
      {dealValue != null && ` of $${dealValue.toLocaleString('en-US')}`}
      {pct != null && ` (${pct}%)`}
      {!matches && ' ⚠'}
    </span>
  )
}

// ── Searchable combo-box ──────────────────────────────────────────────────────
// Generic reusable component for any option list.
// Uses position:fixed for the dropdown so it escapes the modal's overflow-y-auto.
export function SearchableSelect({
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

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

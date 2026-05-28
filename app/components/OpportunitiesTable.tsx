'use client'

import { useState, useEffect } from 'react'
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
  country: string
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

export default function OpportunitiesTable({
  opportunities,
  addFormOpen,
  onAddFormOpenChange,
  products: productsProp,
  managers: managersProp,
}: {
  opportunities: Opportunity[]
  addFormOpen?: boolean
  onAddFormOpenChange?: (open: boolean) => void
  products?: string[]
  managers?: string[]
}) {
  const [rows, setRows] = useState<Opportunity[]>(opportunities)
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [internalAddOpen, setInternalAddOpen] = useState(false)

  const isControlled = onAddFormOpenChange !== undefined
  const showAddForm = isControlled ? (addFormOpen ?? false) : internalAddOpen
  function setShowAddForm(v: boolean) {
    isControlled ? onAddFormOpenChange!(v) : setInternalAddOpen(v)
  }

  function handleSaved(updated: Opportunity) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected(updated)
  }

  function handleAdded(newOpp: Opportunity) {
    setRows((prev) => [newOpp, ...prev])
    setShowAddForm(false)
  }

  return (
    <>
      {!isControlled && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Add Opportunity
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {['Name', 'Account Name', 'Country', 'Stage', 'Product', 'Value'].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">
                  No opportunities found.
                </td>
              </tr>
            ) : (
              rows.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => setSelected(opp)}
                  className="cursor-pointer transition-colors hover:bg-zinc-50"
                >
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900">
                    {opp.name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                    {opp.customer_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                    {(opp.country as string) ?? '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StageBadge stage={opp.stage} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                    {(opp.product as string) ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                    {opp.value != null ? formatCurrency(opp.value) : '—'}
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
          products={productsProp}
          managers={managersProp}
        />
      )}

      {showAddForm && (
        <AddOpportunityModal
          onClose={() => setShowAddForm(false)}
          onAdded={handleAdded}
          products={productsProp}
          managers={managersProp}
        />
      )}
    </>
  )
}

export function Modal({
  opportunity,
  onClose,
  onSaved,
  products: productsProp,
  managers: managersProp,
}: {
  opportunity: Opportunity
  onClose: () => void
  onSaved: (updated: Opportunity) => void
  products?: string[]
  managers?: string[]
}) {
  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(toDraft(opportunity))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isLost = draft.stage === 'Loss'
  const isWon  = draft.stage === 'Win'
  const canSave = !isLost || (draft.loss_reason.trim() !== '' && draft.loss_description.trim() !== '')

  // ── Notes state ─────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setNotesLoading(true)
    supabase
      .from('notes')
      .select('id, opportunity_id, content, created_at')
      .eq('opportunity_id', opportunity.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setNotes((data as Note[]) ?? [])
          setNotesLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [opportunity.id])

  async function addNote() {
    if (!noteText.trim()) return

    setAddingNote(true)
    setNoteError(null)

    const { data, error } = await supabase
      .from('notes')
      .insert([{ opportunity_id: opportunity.id, content: noteText }])
      .select()

    setAddingNote(false)

    if (error) {
      setNoteError(error.message)
      return
    }

    // Use the row returned by Supabase if available; fall back to a locally
    // constructed note in case RLS prevents reading after insert.
    const saved: Note = data?.[0] ?? {
      id: crypto.randomUUID(),
      opportunity_id: String(opportunity.id),
      content: noteText,
      created_at: new Date().toISOString(),
    }
    setNotes((prev) => [saved, ...prev])
    setNoteText('')
  }

  // ── Edit handlers ───────────────────────────────────────────────────────────
  function startEdit() {
    setDraft(toDraft(opportunity))
    setSaveError(null)
    setIsEditing(true)
  }

  function cancel() {
    setIsEditing(false)
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)

    const payload = {
      name: draft.name,
      customer_name: draft.customer_name,
      owner: draft.owner || null,
      stage: draft.stage,
      status: draft.status || null,
      product: draft.product || null,
      country: draft.country || null,
      close_date: draft.close_date || null,
      value: draft.value,
      final_win_value: isWon ? draft.final_win_value : null,
      loss_reason: isLost ? draft.loss_reason : null,
      loss_description: isLost ? draft.loss_description : null,
    }

    const { error: sbError } = await supabase
      .from('opportunities')
      .update(payload)
      .eq('id', opportunity.id)

    setSaving(false)

    if (sbError) {
      setSaveError(sbError.message)
      return
    }

    onSaved({ ...opportunity, ...payload })
    setIsEditing(false)
  }

  async function saveAndClose() {
    await save()
    onClose()
  }

  const opp = isEditing ? { ...opportunity, ...draft } : opportunity

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={!isEditing ? onClose : undefined}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable body */}
        <div className="overflow-y-auto px-8 pt-8 pb-4">

          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            {isEditing ? (
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xl font-semibold text-zinc-900 focus:border-zinc-500 focus:outline-none"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            ) : (
              <h2 className="text-xl font-semibold text-zinc-900">{opp.name}</h2>
            )}
            <button
              onClick={onClose}
              className="ml-4 shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Detail fields */}
          <dl className="space-y-4">
            <DetailRow
              label="Account Name"
              value={
                isEditing ? (
                  <input
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.customer_name}
                    onChange={(e) => setDraft((d) => ({ ...d, customer_name: e.target.value }))}
                  />
                ) : (
                  opp.customer_name ?? '—'
                )
              }
            />

            <DetailRow
              label="Owner"
              value={
                isEditing ? (
                  managersProp && managersProp.length > 0 ? (
                    <select
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                      value={draft.owner}
                      onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                    >
                      <option value="">— Unassigned —</option>
                      {managersProp.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                      value={draft.owner}
                      onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                      placeholder="Manager name"
                    />
                  )
                ) : (
                  (opp.owner as string) ?? '—'
                )
              }
            />

            <DetailRow
              label="Stage"
              value={
                isEditing ? (
                  <select
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.stage}
                    onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <StageBadge stage={opp.stage} />
                )
              }
            />

            {isEditing && isLost && (
              <>
                <DetailRow
                  label="Loss Reason"
                  value={
                    <select
                      className={`w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none ${
                        draft.loss_reason.trim() === ''
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-zinc-300 focus:border-zinc-500'
                      }`}
                      value={draft.loss_reason}
                      onChange={(e) => setDraft((d) => ({ ...d, loss_reason: e.target.value }))}
                    >
                      <option value="">Select a reason…</option>
                      {['Lost to competitor', 'No budget', 'Pricing too high', 'Other'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  }
                />
                <DetailRow
                  label="Loss Description"
                  value={
                    <textarea
                      rows={3}
                      className={`w-full resize-none rounded-md border px-3 py-1.5 text-sm focus:outline-none ${
                        draft.loss_description.trim() === ''
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-zinc-300 focus:border-zinc-500'
                      }`}
                      placeholder="Required"
                      value={draft.loss_description}
                      onChange={(e) => setDraft((d) => ({ ...d, loss_description: e.target.value }))}
                    />
                  }
                />
              </>
            )}

            {!isEditing && opp.loss_reason && (
              <DetailRow label="Loss Reason" value={opp.loss_reason} />
            )}
            {!isEditing && opp.loss_description && (
              <DetailRow label="Loss Description" value={opp.loss_description} />
            )}

            <DetailRow
              label="Status"
              value={
                isEditing ? (
                  <select
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {['On Track', 'Risk', 'Critical'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  (opp.status as string) ? <StatusBadge status={opp.status as string} /> : '—'
                )
              }
            />

            <DetailRow
              label="Country"
              value={
                isEditing ? (
                  <input
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    placeholder="e.g. Israel"
                    value={draft.country}
                    onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                  />
                ) : (
                  (opp.country as string) ?? '—'
                )
              }
            />

            <DetailRow
              label="Close Date"
              value={
                isEditing ? (
                  <select
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.close_date}
                    onChange={(e) => setDraft((d) => ({ ...d, close_date: e.target.value }))}
                  >
                    <option value="">— Select quarter —</option>
                    {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                ) : (
                  (opp as any).close_date ?? '—'
                )
              }
            />

            <DetailRow
              label="Product"
              value={
                isEditing ? (
                  <select
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.product}
                    onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {(productsProp ?? PRODUCTS).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  (opp.product as string) ?? '—'
                )
              }
            />

            {/* Final Win Value — only when stage is Win */}
            {isEditing && isWon && (
              <DetailRow
                label="Final Win Value"
                value={
                  <input
                    type="number"
                    className="w-full rounded-lg border border-green-300 px-3 py-1.5 text-sm font-semibold text-green-700 focus:border-green-500 focus:outline-none"
                    placeholder="Actual closed deal size"
                    value={draft.final_win_value ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, final_win_value: e.target.value === '' ? null : Number(e.target.value) }))
                    }
                  />
                }
              />
            )}
            {!isEditing && (opp as any).final_win_value != null && (
              <DetailRow
                label="Final Win Value"
                value={<span className="font-semibold text-green-600">{formatCurrency((opp as any).final_win_value)}</span>}
              />
            )}

            <DetailRow
              label="Value"
              value={
                isEditing ? (
                  <input
                    type="number"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                    value={draft.value ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, value: e.target.value === '' ? null : Number(e.target.value) }))
                    }
                  />
                ) : (
                  opp.value != null ? formatCurrency(opp.value) : '—'
                )
              }
            />

            {Object.entries(opp)
              .filter(([k]) => !['id', 'name', 'customer_name', 'owner', 'stage', 'status', 'product', 'country', 'close_date', 'value', 'final_win_value', 'loss_reason', 'loss_description'].includes(k))
              .map(([k, v]) => (
                <DetailRow key={k} label={toLabel(k)} value={String(v ?? '—')} />
              ))}
          </dl>

          {isEditing && isLost && !canSave && (
            <p className="mt-4 text-xs text-red-500">
              Loss Reason and Loss Description are required when stage is Loss.
            </p>
          )}
          {saveError && <p className="mt-4 text-sm text-red-500">{saveError}</p>}

          {/* ── Notes timeline ─────────────────────────────────────────────── */}
          <div className="mt-8 border-t border-zinc-100 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Notes
            </h3>

            {/* Plain Text Input Field */}
            <div className="mt-4">
              <textarea
                className="w-full p-2 border rounded-md text-gray-900"
                placeholder="Type a plain text note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              {noteError && <p className="text-xs text-red-500 mt-1">{noteError}</p>}
              <button
                onClick={addNote}
                disabled={addingNote || noteText.trim() === ''}
                className="mt-2 bg-black text-white px-4 py-2 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addingNote ? 'Adding…' : 'Add Note'}
              </button>
            </div>

            {/* The Timeline Feed */}
            <div className="mt-6 space-y-4">
              {notesLoading ? (
                <p className="text-sm text-gray-400">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-gray-400">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                    <span className="text-xs text-gray-400 block mt-1">
                      {formatTimestamp(note.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer with action buttons */}
        <div className="shrink-0 border-t border-zinc-100 px-8 py-4 flex justify-end gap-2">
          {isEditing ? (
            <>
              <button
                onClick={cancel}
                disabled={saving}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !canSave}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={saveAndClose}
                disabled={saving || !canSave}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save & Close'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AddOpportunityModal({
  onClose,
  onAdded,
  products: productsProp,
  managers: managersProp,
  defaultOwner = '',
}: {
  onClose: () => void
  onAdded: (opp: Opportunity) => void
  products?: string[]
  managers?: string[]
  defaultOwner?: string
}) {
  const [form, setForm] = useState({ name: '', customer_name: '', country: '', owner: defaultOwner, stage: 'Discovery', product: '', status: '', close_date: '', value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      country: (form as any).country || null,
      close_date: form.close_date || null,
      value: form.value === '' ? null : Number(form.value),
    }

    const { data, error: sbError } = await supabase
      .from('opportunities')
      .insert([payload])
      .select()

    setSaving(false)

    if (sbError) {
      setError(sbError.message)
      return
    }

    onAdded((data?.[0] ?? { id: crypto.randomUUID(), ...payload, loss_reason: null, loss_description: null }) as Opportunity)
  }

  const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">New Opportunity</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <dl className="space-y-4">
          <DetailRow
            label="Name"
            value={
              <input autoFocus className={inputCls} placeholder="Opportunity name"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            }
          />
          <DetailRow
            label="Account Name"
            value={
              <input className={inputCls} placeholder="Account or company"
                value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
            }
          />
          <DetailRow
            label="Country"
            value={
              <input className={inputCls} placeholder="e.g. Israel"
                value={(form as any).country ?? ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            }
          />
          <DetailRow
            label="Owner"
            value={
              managersProp && managersProp.length > 0 ? (
                <select className={inputCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                  <option value="">— Unassigned —</option>
                  {managersProp.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="Manager name"
                  value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
              )
            }
          />
          <DetailRow
            label="Stage"
            value={
              <select className={inputCls} value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            }
          />
          <DetailRow
            label="Status"
            value={
              <select className={inputCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="">— None —</option>
                {['On Track', 'Risk', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            }
          />
          <DetailRow
            label="Close Date"
            value={
              <select className={inputCls} value={form.close_date} onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value }))}>
                <option value="">— Select quarter —</option>
                {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            }
          />
          <DetailRow
            label="Product"
            value={
              <select className={inputCls} value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}>
                <option value="">— None —</option>
                {(productsProp ?? PRODUCTS).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            }
          />
          <DetailRow
            label="Value"
            value={
              <input type="number" className={inputCls} placeholder="0"
                value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            }
          />
        </dl>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Add Opportunity'}
          </button>
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
    value: opp.value,
    final_win_value: (opp as any).final_win_value ?? null,
    loss_reason: opp.loss_reason ?? '',
    loss_description: opp.loss_description ?? '',
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-36 shrink-0 text-sm font-medium text-zinc-500">{label}</dt>
      <dd className="flex-1 text-sm text-zinc-800">{value}</dd>
    </div>
  )
}

const stageColors: Record<string, string> = {
  initial: 'bg-blue-100 text-blue-700',
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTimestamp(ts: string) {
  const d    = new Date(ts)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  const hh   = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  const sec  = String(d.getSeconds()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${sec}`
}

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

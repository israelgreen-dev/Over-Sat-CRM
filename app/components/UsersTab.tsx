'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  name: string
  role: 'admin' | 'head_of_sales' | 'manager' | 'partner'
  email: string
  created_at: string
}

const ROLES: User['role'][] = ['admin', 'head_of_sales', 'manager', 'partner']

const ROLE_LABELS: Record<User['role'], string> = {
  admin:         'Admin',
  head_of_sales: 'Head of Sales',
  manager:       'Sales Manager',
  partner:       'Partner',
}

const ROLE_COLORS: Record<User['role'], string> = {
  admin:         'bg-purple-100 text-purple-700',
  head_of_sales: 'bg-slate-100 text-slate-700',
  manager:       'bg-blue-100 text-blue-700',
  partner:       'bg-emerald-100 text-emerald-700',
}

// ── Invitation email preview component ────────────────────────────────────────
function InvitePreview({ name, email, role }: { name: string; email: string; role: User['role'] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden text-sm font-sans shadow-inner">
      {/* Email header bar */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 text-xs text-gray-500">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <span className="flex-1 truncate">
          <strong>To:</strong> {email || 'user@example.com'} &nbsp;·&nbsp;
          <strong>Subject:</strong> You've been invited to Over-Sat CRM
        </span>
      </div>

      {/* Email body */}
      <div className="p-6">
        {/* Brand header */}
        <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-5">
          <div className="flex h-10 w-36 items-center overflow-hidden rounded-lg">
            <img src="/OS-Logo.png" alt="Over-Sat" className="h-full w-full object-contain" />
          </div>
          <div className="border-l border-gray-200 pl-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Over-Sat CRM</p>
          </div>
        </div>

        {/* Greeting */}
        <p className="mb-3 text-gray-700">
          Hi <strong>{name || 'there'}</strong>,
        </p>
        <p className="mb-4 text-gray-600 leading-relaxed">
          You've been invited to join <strong>Over-Sat CRM</strong> as a{' '}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>.
        </p>

        {/* What you can do */}
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Your access</p>
          <p className="text-gray-600 text-xs leading-relaxed">
            {role === 'admin' || role === 'head_of_sales'
              ? 'Full access — view and edit all leads, opportunities, analytics, targets, and settings.'
              : role === 'manager'
              ? 'Sales Manager access — view and manage your own leads, opportunities, and performance.'
              : 'Partner access — view-only access to opportunity data and analytics.'}
          </p>
        </div>

        {/* CTA */}
        <div className="mb-5 text-center">
          <div className="inline-block rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white">
            Accept Invitation & Set Password →
          </div>
          <p className="mt-2 text-xs text-gray-400">
            This link will expire in 24 hours.
          </p>
        </div>

        {/* Login info */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 mb-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-400">Your login details</p>
          <p className="text-xs text-blue-700"><strong>Email:</strong> {email || 'user@example.com'}</p>
          <p className="text-xs text-blue-700 mt-0.5"><strong>CRM URL:</strong> {typeof window !== 'undefined' ? window.location.origin : 'https://your-crm-url.com'}</p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
          <p>Over-Sat Proprietary &amp; Confidential</p>
          <p className="mt-0.5">If you did not expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  )
}

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({
  user,
  onClose,
  onSent,
}: {
  user: { name: string; email: string; role: User['role'] }
  onClose: () => void
  onSent: () => void
}) {
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sent, setSent]       = useState(false)

  async function sendInvite() {
    setSending(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
    })
    const json = await res.json()
    setSending(false)
    if (!res.ok) { setError(json.error); return }
    setSent(true)
    // Capture callbacks immediately — by the time the timeout fires the
    // parent may have already set inviteTarget to null (modal dismissed),
    // which would cause onSent to read inviteTarget.email off null.
    const _onSent = onSent
    const _onClose = onClose
    setTimeout(() => { _onSent(); _onClose() }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Send Invitation</h3>
            <p className="text-xs text-gray-400 mt-0.5">Preview the email before sending to <strong>{user.email}</strong></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <InvitePreview name={user.name} email={user.email} role={user.role} />
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
          {sent ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Invitation sent!
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={sending}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {sending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)
  const [noServiceKey, setNoServiceKey] = useState(false)

  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'manager' as User['role'] })
  const [resetUserId, setResetUserId]   = useState<string | null>(null)
  const [sentResetIds, setSentResetIds] = useState<Set<string>>(new Set())
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set())

  // Invite modal state
  const [inviteTarget, setInviteTarget] = useState<{ name: string; email: string; role: User['role'] } | null>(null)
  // Show invite preview before sending (for newly created user)
  const [pendingInvite, setPendingInvite] = useState<{ name: string; email: string; role: User['role'] } | null>(null)

  // Get the current session's JWT to authenticate admin API calls
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
  }, [])

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users', { headers: await authHeaders() })
    const json = await res.json()
    setLoading(false)
    if (res.status === 503) { setNoServiceKey(true); return }
    if (json.users) setUsers(json.users)
  }

  async function createUser() {
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    const created = { name: form.name, email: form.email, role: form.role }
    setShowForm(false)
    setForm({ email: '', password: '', name: '', role: 'manager' })
    loadUsers()
    // Offer to send invite immediately
    setPendingInvite(created)
  }

  async function updateUser(id: string, updates: { name?: string; role?: string; password?: string }) {
    if (updates.password && updates.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ userId: id, ...updates }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    setEditingId(null)
    loadUsers()
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ userId: id }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    loadUsers()
  }

  async function sendResetEmail(id: string, email: string) {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ userId: id, sendResetEmail: true, email }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    setResetUserId(null)
    setSentResetIds((prev) => new Set(prev).add(id))
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'

  if (noServiceKey) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
        <h3 className="mb-2 text-sm font-bold text-amber-800">Service Role Key Required</h3>
        <p className="text-sm text-amber-700 mb-3">
          To manage users, add your Supabase Service Role Key to <code className="bg-amber-100 px-1 rounded">.env.local</code>:
        </p>
        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>Go to Supabase → Project Settings → API</li>
          <li>Copy the <strong>service_role</strong> secret key</li>
          <li>Open <code className="bg-amber-100 px-1 rounded">.env.local</code> and replace <code className="bg-amber-100 px-1 rounded">your_service_role_key_here</code> with it</li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Invite modal for existing user */}
      {inviteTarget && (
        <InviteModal
          user={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onSent={() => setSentInviteIds((prev) => {
            const u = users.find((u) => u.email === inviteTarget.email)
            return u ? new Set(prev).add(u.id) : prev
          })}
        />
      )}

      {/* Post-create invite prompt */}
      {pendingInvite && (
        <InviteModal
          user={pendingInvite}
          onClose={() => setPendingInvite(null)}
          onSent={() => setPendingInvite(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Users</h2>
          <p className="mt-0.5 text-sm text-gray-400">Manage CRM user accounts and roles.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          + Add User
        </button>
      </div>

      {/* Role permissions legend */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { role: 'admin',         icon: '🔑', perms: 'Edit & view everything' },
          { role: 'head_of_sales', icon: '👁',  perms: 'Edit & view everything' },
          { role: 'manager',       icon: '👤', perms: 'Edit & view own area only' },
          { role: 'partner',       icon: '🤝', perms: 'View only — all data' },
        ] as const).map(({ role, icon, perms }) => (
          <div key={role} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
              <span className="text-base">{icon}</span>
            </div>
            <p className="text-xs text-gray-500">{perms}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Add user form */}
      {showForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900">New User</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Full Name</label>
              <input className={inputCls} placeholder="e.g. Yossi Cohen" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as User['role'] }))}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Email</label>
              <input type="email" className={inputCls} placeholder="user@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Password</label>
              <input type="password" className={inputCls} placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">After creating, you'll be prompted to send an invitation email.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setError(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={createUser}
                disabled={busy || !form.email || !form.password || !form.name}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No users found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', 'Role', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className={u.id === currentUserId ? 'bg-blue-50' : ''}>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {editingId === u.id ? (
                      <EditRow user={u} onSave={(upd) => updateUser(u.id, upd)} onCancel={() => setEditingId(null)} busy={busy} />
                    ) : (
                      <>
                        {u.name || '—'}
                        {u.id === currentUserId && <span className="ml-2 text-xs text-blue-500">(you)</span>}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    {u.role ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role as User['role']] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role as User['role']] ?? u.role}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {editingId !== u.id && resetUserId !== u.id && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => setEditingId(u.id)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">Edit</button>

                        {/* Invite button */}
                        {sentInviteIds.has(u.id) ? (
                          <span className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50">Invite sent ✓</span>
                        ) : (
                          <button
                            onClick={() => setInviteTarget({ name: u.name, email: u.email, role: u.role as User['role'] })}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 border border-slate-200"
                          >
                            ✉ Send Invite
                          </button>
                        )}

                        {/* Reset password */}
                        {sentResetIds.has(u.id) ? (
                          <span className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50">Reset sent ✓</span>
                        ) : (
                          <button onClick={() => setResetUserId(u.id)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50">Reset pw</button>
                        )}

                        {u.id !== currentUserId && (
                          <button onClick={() => deleteUser(u.id)} disabled={busy} title="Delete user" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    {resetUserId === u.id && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Send reset email to <strong>{u.email}</strong>?</span>
                        <button onClick={() => sendResetEmail(u.id, u.email)} disabled={busy} className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Send</button>
                        <button onClick={() => setResetUserId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Edit row ──────────────────────────────────────────────────────────────────
function EditRow({ user, onSave, onCancel, busy }: { user: User; onSave: (u: { name: string; role: string; password?: string }) => void; onCancel: () => void; busy: boolean }) {
  const [name, setName]         = useState(user.name)
  const [role, setRole]         = useState(user.role)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          autoFocus
          placeholder="Full name"
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:border-blue-400 min-w-[130px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
          value={role}
          onChange={(e) => setRole(e.target.value as User['role'])}
        >
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
        >
          {showPw ? 'Hide password' : 'Change password'}
        </button>
      </div>
      {showPw && (
        <input
          type="password"
          placeholder="New password (min. 8 chars)"
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-64"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave({ name, role, ...(password ? { password } : {}) })}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  )
}

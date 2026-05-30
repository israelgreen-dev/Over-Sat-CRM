'use client'

import { useState, useEffect } from 'react'

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

export default function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)
  const [noServiceKey, setNoServiceKey] = useState(false)

  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'manager' as User['role'] })
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    setLoading(false)
    if (res.status === 503) { setNoServiceKey(true); return }
    if (json.users) setUsers(json.users)
  }

  async function createUser() {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    setShowForm(false)
    setForm({ email: '', password: '', name: '', role: 'manager' })
    loadUsers()
  }

  async function updateUser(id: string, updates: { name?: string; role?: string }) {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    loadUsers()
  }

  async function resetPassword(id: string) {
    if (!newPassword.trim()) return
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, password: newPassword }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setError(json.error); return }
    setResetUserId(null)
    setNewPassword('')
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

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

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
          <div className="mt-4 flex justify-end gap-2">
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
      )}

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
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(u.id)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">Edit</button>
                        <button onClick={() => { setResetUserId(u.id); setNewPassword('') }} className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50">Password</button>
                        {u.id !== currentUserId && (
                          <button onClick={() => deleteUser(u.id)} disabled={busy} className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
                        )}
                      </div>
                    )}
                    {resetUserId === u.id && (
                      <div className="flex items-center gap-2">
                        <input type="password" className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-400" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        <button onClick={() => resetPassword(u.id)} disabled={busy || !newPassword.trim()} className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Set</button>
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

function EditRow({ user, onSave, onCancel, busy }: { user: User; onSave: (u: { name: string; role: string }) => void; onCancel: () => void; busy: boolean }) {
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  return (
    <div className="flex items-center gap-2">
      <input className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:border-blue-400" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none" value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <button onClick={() => onSave({ name, role })} disabled={busy} className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Save</button>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
    </div>
  )
}

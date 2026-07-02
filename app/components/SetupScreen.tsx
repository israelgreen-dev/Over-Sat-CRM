'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SetupScreen({ email }: { email: string }) {
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    // SECURITY: only the display name is user-settable. Roles live in
    // app_metadata and are assigned by an admin via the Users tab —
    // self-assigning a role here would let anyone become admin.
    const { error } = await supabase.auth.updateUser({
      data: { name: name.trim() },
    })

    setLoading(false)
    if (error) setError(error.message)
    // On success, onAuthStateChange in Dashboard will pick up the updated metadata
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white mb-4 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-slate-700" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
              <path d="M3.5 3.5a14 14 0 0 0 0 17M20.5 3.5a14 14 0 0 1 0 17" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Over-Sat CRM</h1>
          <p className="mt-1 text-sm text-slate-400">First-time setup — enter your name to continue</p>
        </div>

        <form onSubmit={handleSetup} className="rounded-2xl bg-white p-8 shadow-2xl space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Your Email
            </label>
            <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">{email}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Your Full Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Israel Green"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
            />
            <p className="mt-1.5 text-xs text-gray-400">An administrator assigns your access role — contact them if you remain on this screen after saving.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Setting up…' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}

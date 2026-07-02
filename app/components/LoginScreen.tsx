'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  // 'login' | 'reset' (request form) | 'reset-sent' (confirmation)
  const [mode, setMode]         = useState<'login' | 'reset' | 'reset-sent'>('login')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // The recovery link brings the user back here; Dashboard catches the
    // PASSWORD_RECOVERY event and shows the set-new-password screen.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMode('reset-sent')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-52 items-center justify-center rounded-2xl bg-white mb-4 shadow-lg overflow-hidden px-4 py-2">
            <img src="/OS-Logo.png" alt="Over-Sat Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Over-Sat CRM</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your account</p>
        </div>

        {/* Card */}
        {mode === 'reset-sent' ? (
          <div className="rounded-2xl bg-white p-8 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Check your email</p>
            <p className="text-sm text-gray-500">
              If an account exists for <strong>{email}</strong>, a password-reset link is on its way.
              Open it on this device to set a new password.
            </p>
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
        <form
          onSubmit={mode === 'login' ? handleLogin : handleReset}
          className="rounded-2xl bg-white p-8 shadow-2xl space-y-5"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {mode === 'login' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Sending link…')
              : (mode === 'login' ? 'Sign In' : 'Send Reset Link')}
          </button>

          <p className="text-center">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setMode('reset'); setError(null) }} className="text-xs font-medium text-blue-600 hover:underline">
                Forgot password?
              </button>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-xs font-medium text-blue-600 hover:underline">
                ← Back to sign in
              </button>
            )}
          </p>
        </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Over-Sat Proprietary &amp; Confidential
        </p>
      </div>
    </div>
  )
}

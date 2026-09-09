'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Set-a-new-password screen, reached two ways:
 *
 * 1. Legacy links: Supabase's default recovery link signs the user into a
 *    temporary session on page load (PASSWORD_RECOVERY event) — no token here.
 * 2. Scanner-proof links (`tokenHash` prop): the email links to the app with
 *    ?token_hash=…&type=recovery, and the one-time token is only redeemed
 *    (verifyOtp) when the user SUBMITS this form. Corporate email scanners
 *    (e.g. Microsoft SafeLinks) prefetch every link in an email — with the
 *    default flow that consumes the token before the user ever clicks, which
 *    is the classic cause of "expired link" resets. A form submission is
 *    something a scanner never does.
 */
export default function ResetPasswordScreen({
  tokenHash,
  otpType = 'recovery',
  onDone,
}: {
  tokenHash?: string
  otpType?: 'recovery' | 'invite'
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The token is one-shot: after a successful verifyOtp we hold a session, so
  // a retry (e.g. network blip on updateUser) must not redeem it again.
  const verifiedRef = useRef(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    if (tokenHash && !verifiedRef.current) {
      const { error: otpError } = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
      })
      if (otpError) {
        setLoading(false)
        setError(
          /expired|invalid|not found/i.test(otpError.message)
            ? 'This link has expired or was already used. Go back to the sign-in screen and request a new one with "Forgot password?".'
            : otpError.message,
        )
        return
      }
      verifiedRef.current = true
    }
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onDone()
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors'

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-52 items-center justify-center rounded-2xl bg-white mb-4 shadow-lg overflow-hidden px-4 py-2">
            <Image
              src="/OS-Logo.png"
              alt="Over-Sat Logo"
              width={269}
              height={64}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {otpType === 'invite' ? 'Welcome to Over-Sat CRM' : 'Set a new password'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {otpType === 'invite'
              ? 'Choose a password to activate your account'
              : 'Choose a new password for your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-2xl space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              New Password
            </label>
            <input
              type="password"
              required
              autoFocus
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the new password"
              className={inputCls}
            />
          </div>

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
            {loading ? 'Saving…' : 'Save New Password'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Over-Sat Proprietary &amp; Confidential
        </p>
      </div>
    </div>
  )
}

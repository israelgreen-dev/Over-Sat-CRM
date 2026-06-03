'use client'

/**
 * ErrorBoundary.tsx
 * Catches React render errors so the whole app doesn't go blank.
 * Wrap any subtree: <ErrorBoundary><MyComponent /></ErrorBoundary>
 */

import { Component, type ReactNode } from 'react'

interface Props  { children: ReactNode; fallback?: ReactNode }
interface State  { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // Log to console in development; swap for a real error-tracking service
    // (e.g. Sentry) in production.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-8">
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="mb-1 text-base font-bold text-gray-900">Something went wrong</h2>
            <p className="mb-5 text-sm text-gray-400">{this.state.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={this.handleReset}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

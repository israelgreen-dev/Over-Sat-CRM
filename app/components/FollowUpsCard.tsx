'use client'

import { useMemo } from 'react'
import { type Opportunity } from '@/lib/opportunity'
import { type Lead } from './LeadsTab'
import { FollowUpCell, followUpStatus } from './FollowUpField'

/**
 * "Follow-ups Due" — the actionable card at the top of the Dashboard.
 * Lists open leads/opportunities due today or overdue (most overdue first);
 * rows jump to the matching tab. Renders nothing when nothing is due.
 */
export default function FollowUpsCard({
  leads,
  opportunities,
  showOwner = false,
  onNavigate,
}: {
  leads: Lead[]
  opportunities: Opportunity[]
  /** Team-wide view (Admin/HoS): show each row's owner. */
  showOwner?: boolean
  onNavigate?: (tab: 'Leads' | 'Opportunities') => void
}) {
  const dueFollowUps = useMemo(() => {
    const due: {
      key: string
      kind: 'Lead' | 'Opportunity'
      name: string
      owner: string
      date: string
    }[] = []
    for (const l of leads) {
      if (['Dropped', 'Converted'].includes(l.status ?? 'New')) continue
      const st = followUpStatus(l.follow_up_at)
      if (st === 'overdue' || st === 'today')
        due.push({
          key: `lead-${l.id}`,
          kind: 'Lead',
          name: l.account,
          owner: l.owner ?? '',
          date: l.follow_up_at!,
        })
    }
    for (const o of opportunities) {
      if (['Win', 'Loss'].includes(o.stage)) continue
      const st = followUpStatus(o.follow_up_at)
      if (st === 'overdue' || st === 'today')
        due.push({
          key: `opp-${o.id}`,
          kind: 'Opportunity',
          name: o.name,
          owner: (o.owner as string) ?? '',
          date: o.follow_up_at!,
        })
    }
    // Most overdue first (ISO dates sort correctly as strings).
    return due.sort((a, b) => a.date.localeCompare(b.date))
  }, [leads, opportunities])

  if (dueFollowUps.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md border-t-4 border-red-400">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Follow-ups Due</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {showOwner ? 'Across the whole team' : 'Your leads and opportunities'} — click a row
            to open its tab
          </p>
        </div>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
          {dueFollowUps.length} due
        </span>
      </div>
      <ul className="divide-y divide-gray-50">
        {dueFollowUps.slice(0, 8).map((f) => (
          <li key={f.key}>
            <button
              onClick={() => onNavigate?.(f.kind === 'Lead' ? 'Leads' : 'Opportunities')}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  f.kind === 'Lead' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {f.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                {f.name}
              </span>
              {showOwner && f.owner && (
                <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">{f.owner}</span>
              )}
              <span className="shrink-0 text-xs">
                <FollowUpCell value={f.date} />
              </span>
              <span className="shrink-0 text-gray-300">›</span>
            </button>
          </li>
        ))}
      </ul>
      {dueFollowUps.length > 8 && (
        <p className="mt-2 text-center text-xs text-gray-400">
          …and {dueFollowUps.length - 8} more — filter by ⚠ Overdue in the tabs
        </p>
      )}
    </div>
  )
}

'use client'

// Follow-up scheduling: a date picker plus quick relative shortcuts
// ("Tomorrow", "+1 week", …). Shared by the lead and opportunity forms;
// the status/format helpers and <FollowUpCell> are used by their tables.

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
]

/** yyyy-mm-dd for `days` from today, in local time. */
function inDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export type FollowUpStatus = 'overdue' | 'today' | 'upcoming'

/** Status of a yyyy-mm-dd follow-up value relative to today (null when unset). */
export function followUpStatus(value: string | null | undefined): FollowUpStatus | null {
  if (!value) return null
  const today = inDaysISO(0)
  // ISO date strings compare correctly as plain strings.
  return value < today ? 'overdue' : value === today ? 'today' : 'upcoming'
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

/** Compact date display ("12 Jun 26") for a yyyy-mm-dd value. */
export function fmtFollowUp(value: string | null | undefined): string {
  if (!value) return '—'
  // Parse as local midnight — bare yyyy-mm-dd would be treated as UTC.
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : fmt.format(d)
}

const STATUS_CLASSES: Record<FollowUpStatus, string> = {
  overdue: 'text-red-600 font-semibold',
  today: 'text-amber-600 font-semibold',
  upcoming: 'text-gray-600',
}

const STATUS_TITLES: Record<FollowUpStatus, string> = {
  overdue: 'Follow-up is overdue',
  today: 'Follow up today',
  upcoming: 'Next follow-up',
}

/** Table-cell display: overdue in red, today in amber, upcoming in gray. */
export function FollowUpCell({ value }: { value?: string | null }) {
  const status = followUpStatus(value)
  if (!status) return <span className="text-gray-300">—</span>
  return (
    <span className={STATUS_CLASSES[status]} title={STATUS_TITLES[status]}>
      {status === 'overdue' && '⚠ '}
      {status === 'today' ? 'Today' : fmtFollowUp(value)}
    </span>
  )
}

/** Sort key for table sorting: unset dates go last. */
export function followUpSortValue(value: string | null | undefined): number {
  return value ? new Date(`${value}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
}

export default function FollowUpField({
  value,
  onChange,
  className = '',
}: {
  /** yyyy-mm-dd, or '' when unset. */
  value: string
  onChange: (v: string) => void
  /** Class for the date input (pass the form's shared input class). */
  className?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear follow-up"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {QUICK_PICKS.map((q) => {
          const date = inDaysISO(q.days)
          const active = value === date
          return (
            <button
              type="button"
              key={q.label}
              onClick={() => onChange(date)}
              title={fmtFollowUp(date)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {q.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

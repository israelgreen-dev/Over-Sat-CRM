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
export function inDaysISO(days: number): string {
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

/**
 * Deviation from schedule in whole days: positive = days overdue,
 * 0 = due today, negative = days until due. null when unset.
 */
export function followUpDaysLate(value: string | null | undefined): number | null {
  if (!value) return null
  const ms =
    new Date(`${inDaysISO(0)}T00:00:00`).getTime() - new Date(`${value}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000)
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

/** Compact date display ("12 Jun 26") for a yyyy-mm-dd value. */
export function fmtFollowUp(value: string | null | undefined): string {
  if (!value) return '—'
  // Parse as local midnight — bare yyyy-mm-dd would be treated as UTC.
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : fmt.format(d)
}

/** Human wording for the schedule deviation ("3 days late", "due today"). */
export function fmtDeviation(daysLate: number): string {
  if (daysLate > 0) return `${daysLate} day${daysLate !== 1 ? 's' : ''} late`
  if (daysLate === 0) return 'due today'
  return `in ${-daysLate} day${daysLate !== -1 ? 's' : ''}`
}

/**
 * Table-cell display with the deviation from schedule:
 * overdue → red pill with days late, today → amber pill, upcoming → gray date.
 */
export function FollowUpCell({ value }: { value?: string | null }) {
  const daysLate = followUpDaysLate(value)
  if (daysLate === null) return <span className="text-gray-300">—</span>
  if (daysLate > 0)
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600"
        title={`Planned for ${fmtFollowUp(value)} — ${fmtDeviation(daysLate)}`}
      >
        ⚠ {fmtFollowUp(value)} · {daysLate}d late
      </span>
    )
  if (daysLate === 0)
    return (
      <span
        className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-600"
        title="Follow up today"
      >
        Today
      </span>
    )
  return (
    <span className="text-gray-600" title={`Next follow-up ${fmtDeviation(daysLate)}`}>
      {fmtFollowUp(value)}
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
  const daysLate = followUpDaysLate(value)
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
      {/* Deviation from schedule — shown while editing an overdue/due record */}
      {daysLate !== null && daysLate > 0 && (
        <p className="mt-1.5 flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
          ⚠ {fmtDeviation(daysLate)} — reschedule below or clear once handled
        </p>
      )}
      {daysLate === 0 && (
        <p className="mt-1.5 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
          Follow-up is due today
        </p>
      )}
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

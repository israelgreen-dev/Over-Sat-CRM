/**
 * /api/notifications/digest — summary emails (daily / weekly / monthly).
 *
 * Invoked once a day by Vercel Cron (see vercel.json). Based on the mode in
 * Settings → Email Notifications it decides whether a digest is due:
 *   daily   → every run (last 24 h of activity)
 *   weekly  → Mondays   (last 7 days)
 *   monthly → the 1st   (previous calendar month)
 *
 * Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the
 * CRON_SECRET env var is set. An admin bearer token also works, so the
 * digest can be triggered manually for testing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { sendMail, emailShell, mailerConfigured } from '@/lib/mailer'
import { serviceClient, resolveRecipients } from '@/lib/recipients'
import { EVENT_LABELS, type NotificationEvent, type NotificationSettings } from '@/lib/notification-types'

type AuditRow = { action: string; changed_by: string | null; changed_at: string; changes: Record<string, { old: unknown; new: unknown }> }

const ACTION_TO_EVENT: Record<string, { lead: NotificationEvent; opp: NotificationEvent }> = {
  INSERT: { lead: 'lead_created', opp: 'opp_created' },
  UPDATE: { lead: 'lead_updated', opp: 'opp_updated' },
  DELETE: { lead: 'lead_deleted', opp: 'opp_deleted' },
}

function entryName(row: AuditRow, key: 'name' | 'account'): string {
  const c = row.changes ?? {}
  return String(c[key]?.new ?? c[key]?.old ?? (c[`_${key}`] as unknown) ?? '') || '—'
}

export async function GET(req: NextRequest) {
  // Auth: cron secret, or an admin bearer token for manual runs.
  const auth = req.headers.get('Authorization') ?? ''
  const cronOk = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`
  if (!cronOk) {
    const { user, error } = await requireAdmin(req)
    if (error || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 })
  }

  const sb = serviceClient()
  const { data: settingsRow } = await sb.from('crm_settings').select('notification_settings').eq('id', 1).single()
  const settings = (settingsRow?.notification_settings ?? {}) as Partial<NotificationSettings>

  if (!settings.enabled)           return NextResponse.json({ sent: false, reason: 'disabled' })
  if (settings.mode === 'instant') return NextResponse.json({ sent: false, reason: 'instant-mode' })
  if (!mailerConfigured())         return NextResponse.json({ sent: false, reason: 'smtp-not-configured' })

  // Is a digest due today? (Manual admin runs always send, for testing.)
  const now = new Date()
  const due =
    settings.mode === 'daily' ||
    (settings.mode === 'weekly' && now.getUTCDay() === 1) ||
    (settings.mode === 'monthly' && now.getUTCDate() === 1)
  if (cronOk && !due) return NextResponse.json({ sent: false, reason: 'not-due' })

  // Activity window
  const since = new Date(now)
  if (settings.mode === 'daily')  since.setUTCDate(now.getUTCDate() - 1)
  if (settings.mode === 'weekly') since.setUTCDate(now.getUTCDate() - 7)
  if (settings.mode === 'monthly') since.setUTCMonth(now.getUTCMonth() - 1)

  const [oppAudit, leadAudit] = await Promise.all([
    sb.from('opportunity_audit').select('action, changed_by, changed_at, changes')
      .gte('changed_at', since.toISOString()).order('changed_at', { ascending: false }).limit(500),
    sb.from('lead_audit').select('action, changed_by, changed_at, changes')
      .gte('changed_at', since.toISOString()).order('changed_at', { ascending: false }).limit(500),
  ])

  const events = settings.events ?? {}
  const sections: string[] = []
  let total = 0

  function section(title: string, rows: AuditRow[], kind: 'lead' | 'opp', nameKey: 'name' | 'account') {
    const included = rows.filter((r) => events[ACTION_TO_EVENT[r.action]?.[kind]] !== false)
    if (included.length === 0) return
    total += included.length
    const items = included.slice(0, 30).map((r) =>
      `<li><strong>${EVENT_LABELS[ACTION_TO_EVENT[r.action][kind]]}</strong> — ${entryName(r, nameKey)}
        <span style="color:#9ca3af">(${r.changed_by ?? 'unknown'}, ${new Date(r.changed_at).toUTCString().slice(0, 22)})</span></li>`,
    ).join('')
    sections.push(`<h3 style="margin:12px 0 4px;font-size:14px">${title} (${included.length})</h3><ul style="margin:0;padding-left:18px">${items}${included.length > 30 ? '<li>…and more</li>' : ''}</ul>`)
  }

  section('Leads',         (leadAudit.data ?? []) as AuditRow[], 'lead', 'account')
  section('Opportunities', (oppAudit.data  ?? []) as AuditRow[], 'opp',  'name')

  if (total === 0) return NextResponse.json({ sent: false, reason: 'no-activity' })

  const period = settings.mode === 'daily' ? 'Daily' : settings.mode === 'weekly' ? 'Weekly' : 'Monthly'
  const recipients = await resolveRecipients(sb)
  const body = emailShell(`${period} summary · ${total} change${total !== 1 ? 's' : ''}`, sections.join('') +
    `<p style="margin-top:12px"><a href="https://over-sat-crm.com" style="color:#f97316">Open the CRM →</a></p>`)

  try {
    const sent = await sendMail(recipients, `[Over-Sat CRM] ${period} summary — ${total} change${total !== 1 ? 's' : ''}`, body)
    return NextResponse.json({ sent, total })
  } catch (e) {
    return NextResponse.json({ sent: false, reason: e instanceof Error ? e.message : 'send-failed' })
  }
}

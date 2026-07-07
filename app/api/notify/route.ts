/**
 * /api/notify — instant email notifications.
 * The client calls this (fire-and-forget) after a lead/opportunity is
 * created, updated or deleted. Recipients are resolved automatically:
 * every user whose role is admin or head_of_sales.
 *
 * No-ops (200) when notifications are disabled, the event is unchecked,
 * the mode is a digest, or SMTP isn't configured yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { rateLimit, callerIp } from '@/lib/rate-limit'
import { sendMail, emailShell, mailerConfigured } from '@/lib/mailer'
import { serviceClient, resolveRecipients } from '@/lib/recipients'
import { NOTIFICATION_EVENTS, EVENT_LABELS, type NotificationEvent, type NotificationSettings } from '@/lib/notification-types'

export async function POST(req: NextRequest) {
  if (!rateLimit(callerIp(req), 60)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireUser(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const { event, name } = await req.json() as { event: NotificationEvent; name?: string }
  if (!NOTIFICATION_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: settingsRow } = await sb.from('crm_settings').select('notification_settings').eq('id', 1).single()
  const settings = (settingsRow?.notification_settings ?? {}) as Partial<NotificationSettings>

  if (!settings.enabled)                  return NextResponse.json({ sent: false, reason: 'disabled' })
  if (settings.mode !== 'instant')        return NextResponse.json({ sent: false, reason: 'digest-mode' })
  if (settings.events?.[event] === false) return NextResponse.json({ sent: false, reason: 'event-off' })
  if (!mailerConfigured())                return NextResponse.json({ sent: false, reason: 'smtp-not-configured' })

  const recipients = await resolveRecipients(sb)
  const label   = EVENT_LABELS[event]
  const subject = `[Over-Sat CRM] ${label}${name ? `: ${name}` : ''}`
  const body    = emailShell('Instant notification', `
    <p><strong>${label}</strong>${name ? ` — <strong>${name}</strong>` : ''}</p>
    <p style="color:#6b7280">By ${user.email} · ${new Date().toUTCString()}</p>
    <p><a href="https://over-sat-crm.com" style="color:#f97316">Open the CRM →</a></p>
  `)

  try {
    const sent = await sendMail(recipients, subject, body)
    return NextResponse.json({ sent })
  } catch (e) {
    return NextResponse.json({ sent: false, reason: e instanceof Error ? e.message : 'send-failed' })
  }
}

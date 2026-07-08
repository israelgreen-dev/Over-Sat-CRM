/**
 * /api/notify — instant email notifications.
 * The client calls this (fire-and-forget) after a lead/opportunity is
 * created, updated or deleted. Admin and Head of Sales each have their own
 * configuration (enabled / mode / events) and receive independently.
 *
 * No-ops (200) whenever nothing applies (disabled, digest mode, event
 * unchecked, SMTP not configured).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { rateLimit, callerIp } from '@/lib/rate-limit'
import { sendMail, emailShell, mailerConfigured } from '@/lib/mailer'
import { serviceClient, resolveRecipientsByRole } from '@/lib/recipients'
import {
  NOTIFICATION_EVENTS, EVENT_LABELS, NOTIFY_ROLES,
  normalizeNotificationConfig, type NotificationEvent,
} from '@/lib/notification-types'

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
  const config = normalizeNotificationConfig(settingsRow?.notification_settings)

  // Which role groups want this event instantly?
  const wantingRoles = NOTIFY_ROLES.filter((role) => {
    const c = config[role]
    return c.enabled && c.mode === 'instant' && c.events?.[event] !== false
  })
  if (wantingRoles.length === 0) return NextResponse.json({ sent: false, reason: 'no-role-subscribed' })
  if (!mailerConfigured())       return NextResponse.json({ sent: false, reason: 'smtp-not-configured' })

  // Explicit per-role recipient lists take precedence; otherwise all users
  // of the role receive the email.
  const byRole = await resolveRecipientsByRole(sb)
  const recipients = Array.from(new Set(wantingRoles.flatMap((r) => {
    const explicit = (config[r].recipients ?? []).map((e) => e.trim()).filter((e) => e.includes('@'))
    return explicit.length > 0 ? explicit : byRole[r]
  })))
  if (recipients.length === 0) return NextResponse.json({ sent: false, reason: 'no-recipients' })

  const label   = EVENT_LABELS[event]
  const subject = `[Over-Sat CRM] ${label}${name ? `: ${name}` : ''}`
  const body    = emailShell('Instant notification', `
    <p><strong>${label}</strong>${name ? ` — <strong>${name}</strong>` : ''}</p>
    <p style="color:#6b7280">By ${user.email} · ${new Date().toUTCString()}</p>
    <p><a href="https://over-sat-crm.com" style="color:#f97316">Open the CRM →</a></p>
  `)

  try {
    const sent = await sendMail(recipients, subject, body)
    return NextResponse.json({ sent, roles: wantingRoles })
  } catch (e) {
    return NextResponse.json({ sent: false, reason: e instanceof Error ? e.message : 'send-failed' })
  }
}

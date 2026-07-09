/**
 * notify.ts (client)
 * Fire-and-forget instant-notification ping after a lead/opportunity
 * mutation. Never blocks or fails the user's action — the server decides
 * whether an email actually goes out (settings, mode, SMTP).
 *
 * `details` is an ordered label → value map rendered as a table in the
 * email; empty values are dropped automatically.
 */

import { supabase } from './supabase'
import type { NotificationEvent } from './notification-types'

export function notifyEvent(
  event: NotificationEvent,
  name?: string,
  details?: Record<string, string | number | null | undefined>,
): void {
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const clean: Record<string, string> = {}
      for (const [k, v] of Object.entries(details ?? {})) {
        const s = String(v ?? '').trim()
        if (s) clean[k] = s
      }

      await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ event, name, details: clean }),
      })
    } catch { /* notification failures must never surface to the user */ }
  })()
}

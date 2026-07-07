/**
 * notify.ts (client)
 * Fire-and-forget instant-notification ping after a lead/opportunity
 * mutation. Never blocks or fails the user's action — the server decides
 * whether an email actually goes out (settings, mode, SMTP).
 */

import { supabase } from './supabase'
import type { NotificationEvent } from './notification-types'

export function notifyEvent(event: NotificationEvent, name?: string): void {
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ event, name }),
      })
    } catch { /* notification failures must never surface to the user */ }
  })()
}

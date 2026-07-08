/**
 * notification-types.ts
 * Shared shape for the email-notification settings (client + server).
 * Admin and Head of Sales each have an independent configuration.
 */

export const NOTIFICATION_EVENTS = [
  'lead_created', 'lead_updated', 'lead_deleted',
  'opp_created', 'opp_updated', 'opp_deleted',
] as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  lead_created: 'Lead created',
  lead_updated: 'Lead updated',
  lead_deleted: 'Lead deleted',
  opp_created:  'Opportunity created',
  opp_updated:  'Opportunity updated',
  opp_deleted:  'Opportunity deleted',
}

export type NotificationMode = 'instant' | 'daily' | 'weekly' | 'monthly'

/** Per-role configuration. */
export type NotificationSettings = {
  enabled: boolean
  mode: NotificationMode
  events: Partial<Record<NotificationEvent, boolean>>
  /** Explicit recipient emails. Empty/absent = automatic (all users of the role). */
  recipients?: string[]
}

export const NOTIFY_ROLES = ['admin', 'head_of_sales'] as const
export type NotifyRole = (typeof NOTIFY_ROLES)[number]

export const NOTIFY_ROLE_LABELS: Record<NotifyRole, string> = {
  admin: 'Admin',
  head_of_sales: 'Head of Sales',
}

/** What's stored in crm_settings.notification_settings. */
export type NotificationConfig = Record<NotifyRole, NotificationSettings>

export const DEFAULT_ROLE_SETTINGS: NotificationSettings = {
  enabled: false,
  mode: 'instant',
  events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, true])),
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  admin:         { ...DEFAULT_ROLE_SETTINGS, events: { ...DEFAULT_ROLE_SETTINGS.events } },
  head_of_sales: { ...DEFAULT_ROLE_SETTINGS, events: { ...DEFAULT_ROLE_SETTINGS.events } },
}

/**
 * Accepts whatever is stored (per-role config, the earlier single flat
 * config, or nothing) and returns a full per-role config.
 */
export function normalizeNotificationConfig(raw: unknown): NotificationConfig {
  const r = (raw ?? {}) as Record<string, unknown>
  // Legacy flat shape ({ enabled, mode, events }) applies to both roles.
  if ('enabled' in r && !('admin' in r)) {
    const flat = { ...DEFAULT_ROLE_SETTINGS, ...(r as Partial<NotificationSettings>) }
    return { admin: { ...flat }, head_of_sales: { ...flat } }
  }
  const cfg = r as Partial<NotificationConfig>
  return {
    admin:         { ...DEFAULT_ROLE_SETTINGS, ...(cfg.admin ?? {}) },
    head_of_sales: { ...DEFAULT_ROLE_SETTINGS, ...(cfg.head_of_sales ?? {}) },
  }
}

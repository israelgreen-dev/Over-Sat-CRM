/**
 * notification-types.ts
 * Shared shape for the email-notification settings (client + server).
 * Admin and Head of Sales each have an independent configuration.
 */

export const NOTIFICATION_EVENTS = [
  'lead_created',
  'lead_updated',
  'lead_deleted',
  'opp_created',
  'opp_updated',
  'opp_deleted',
] as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  lead_created: 'Lead created',
  lead_updated: 'Lead updated',
  lead_deleted: 'Lead deleted',
  opp_created: 'Opportunity created',
  opp_updated: 'Opportunity updated',
  opp_deleted: 'Opportunity deleted',
}

export type NotificationMode = 'instant' | 'daily' | 'weekly' | 'monthly'

/** Per-role configuration. Recipients are always derived from the user
 *  accounts of that role (Users section) — never stored here. */
export type NotificationSettings = {
  enabled: boolean
  mode: NotificationMode
  events: Partial<Record<NotificationEvent, boolean>>
}

export const NOTIFY_ROLES = ['admin', 'head_of_sales'] as const
export type NotifyRole = (typeof NOTIFY_ROLES)[number]

export const NOTIFY_ROLE_LABELS: Record<NotifyRole, string> = {
  admin: 'Admin',
  head_of_sales: 'Head of Sales',
}

/**
 * Follow-up reminder configuration (daily cron):
 *  - owners: every record owner gets a personal email listing THEIR leads /
 *    opportunities whose follow-up is due (managers, dual-role users, anyone
 *    who owns records).
 *  - admin / head_of_sales: that role's users also get a team-wide summary
 *    of everyone's due follow-ups.
 *  - remindDaysBefore: start reminding this many days ahead (0 = due date).
 *  - overdueDaily: keep emailing every day while overdue; off = remind only
 *    until the due date passes.
 */
export type FollowUpSettings = {
  owners: boolean
  admin: boolean
  head_of_sales: boolean
  remindDaysBefore: number
  overdueDaily: boolean
}

export const DEFAULT_FOLLOW_UP_SETTINGS: FollowUpSettings = {
  // Matches the behavior before this was configurable.
  owners: true,
  admin: false,
  head_of_sales: false,
  remindDaysBefore: 0,
  overdueDaily: true,
}

/** What's stored in crm_settings.notification_settings. */
export type NotificationConfig = Record<NotifyRole, NotificationSettings> & {
  followUps: FollowUpSettings
}

export const DEFAULT_ROLE_SETTINGS: NotificationSettings = {
  enabled: false,
  mode: 'instant',
  events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, true])),
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  admin: { ...DEFAULT_ROLE_SETTINGS, events: { ...DEFAULT_ROLE_SETTINGS.events } },
  head_of_sales: { ...DEFAULT_ROLE_SETTINGS, events: { ...DEFAULT_ROLE_SETTINGS.events } },
  followUps: { ...DEFAULT_FOLLOW_UP_SETTINGS },
}

/**
 * Accepts whatever is stored (per-role config with or without followUps,
 * the earlier single flat config, or nothing) and returns a full config.
 */
export function normalizeNotificationConfig(raw: unknown): NotificationConfig {
  const r = (raw ?? {}) as Record<string, unknown>
  const followUps: FollowUpSettings = {
    ...DEFAULT_FOLLOW_UP_SETTINGS,
    ...((r.followUps as Partial<FollowUpSettings>) ?? {}),
  }
  // Legacy flat shape ({ enabled, mode, events }) applies to both roles.
  if ('enabled' in r && !('admin' in r)) {
    const flat = { ...DEFAULT_ROLE_SETTINGS, ...(r as Partial<NotificationSettings>) }
    return { admin: { ...flat }, head_of_sales: { ...flat }, followUps }
  }
  const cfg = r as Partial<NotificationConfig>
  return {
    admin: { ...DEFAULT_ROLE_SETTINGS, ...(cfg.admin ?? {}) },
    head_of_sales: { ...DEFAULT_ROLE_SETTINGS, ...(cfg.head_of_sales ?? {}) },
    followUps,
  }
}

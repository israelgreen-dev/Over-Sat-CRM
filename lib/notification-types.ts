/**
 * notification-types.ts
 * Shared shape for the email-notification settings (client + server).
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

export type NotificationSettings = {
  enabled: boolean
  mode: NotificationMode
  events: Partial<Record<NotificationEvent, boolean>>
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  mode: 'instant',
  events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, true])),
}

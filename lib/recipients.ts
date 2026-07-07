/**
 * recipients.ts (server-only)
 * Resolves who receives CRM notification emails: every user whose role
 * (app_metadata) is admin or head_of_sales.
 */

import { createClient } from '@supabase/supabase-js'

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function resolveRecipients(sb = serviceClient()): Promise<string[]> {
  const byRole = await resolveRecipientsByRole(sb)
  return [...byRole.admin, ...byRole.head_of_sales]
}

/** Emails grouped by role — admin and head_of_sales configs differ. */
export async function resolveRecipientsByRole(sb = serviceClient()): Promise<{ admin: string[]; head_of_sales: string[] }> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { admin: [], head_of_sales: [] }
  const pick = (role: string) => data.users
    .filter((u) => ((u.app_metadata?.role as string) ?? '') === role)
    .map((u) => u.email ?? '')
    .filter(Boolean)
  return { admin: pick('admin'), head_of_sales: pick('head_of_sales') }
}

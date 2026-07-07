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
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return []
  return data.users
    .filter((u) => ['admin', 'head_of_sales'].includes((u.app_metadata?.role as string) ?? ''))
    .map((u) => u.email ?? '')
    .filter(Boolean)
}

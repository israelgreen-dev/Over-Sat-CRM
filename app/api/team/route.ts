/**
 * /api/team — minimal team directory for every authenticated user.
 * Returns just { name, role } per user: the app derives its manager/partner/
 * head-of-sales lists from real accounts (single source of truth), and every
 * role needs those names for dropdowns and analytics. Emails and ids are NOT
 * exposed here — full user management stays admin-only (/api/admin/users).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { rateLimit, callerIp } from '@/lib/rate-limit'
import { serviceClient } from '@/lib/recipients'

export async function GET(req: NextRequest) {
  if (!rateLimit(callerIp(req), 60))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireUser(req)
  if (authError || !user)
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const sb = serviceClient()
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const team = data.users
    .map((u) => ({
      name: (u.app_metadata?.name as string) ?? (u.user_metadata?.name as string) ?? '',
      role: (u.app_metadata?.role as string) ?? (u.user_metadata?.role as string) ?? '',
      // Dual role: admin/HoS who also acts as a sales manager.
      alsoManager: !!u.app_metadata?.also_manager,
    }))
    .filter((u) => u.name && ['admin', 'head_of_sales', 'manager', 'partner'].includes(u.role))

  return NextResponse.json(team)
}

/**
 * /api/admin/invite
 * Sends a Supabase magic-link invitation to a new user.
 * Requires admin or head_of_sales role.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { rateLimit, callerIp } from '@/lib/rate-limit'

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || serviceKey === 'your_service_role_key_here') return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// POST /api/admin/invite — invite a user by email (sends magic-link invite)
export async function POST(req: NextRequest) {
  if (!rateLimit(callerIp(req), 5)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireAdmin(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { email, name, role } = await req.json()
  if (!email || !name || !role) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, user: { id: data.user.id, email, name, role } })
}

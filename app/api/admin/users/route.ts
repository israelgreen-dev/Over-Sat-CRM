/**
 * /api/admin/users
 * Admin-only CRUD for Supabase Auth users.
 * Every route verifies the caller is an authenticated admin or head_of_sales.
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

// Roles are stored in app_metadata (server-only) — see lib/api-auth.ts.
const VALID_ROLES = ['admin', 'head_of_sales', 'manager', 'partner'] as const

function isValidRole(role: unknown): role is (typeof VALID_ROLES)[number] {
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role)
}

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  if (!rateLimit(callerIp(req), 60)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireAdmin(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const users = data.users.map((u) => ({
    id:         u.id,
    email:      u.email,
    // app_metadata is authoritative; user_metadata only as legacy fallback
    name:       u.app_metadata?.name ?? u.user_metadata?.name ?? '',
    role:       u.app_metadata?.role ?? u.user_metadata?.role ?? '',
    created_at: u.created_at,
  }))

  return NextResponse.json({ users })
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  if (!rateLimit(callerIp(req), 10)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireAdmin(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { email, password, name, role } = await req.json()
  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Name + role live in app_metadata (server-only) so users can't edit them;
  // name is mirrored to user_metadata for display compatibility.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role, name },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, user: { id: data.user.id, email, name, role } })
}

// DELETE /api/admin/users — delete a user
export async function DELETE(req: NextRequest) {
  if (!rateLimit(callerIp(req), 10)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireAdmin(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Prevent admins from deleting themselves
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// PATCH /api/admin/users — update name, role, password, or send reset email
export async function PATCH(req: NextRequest) {
  if (!rateLimit(callerIp(req), 20)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error: authError } = await requireAdmin(req)
  if (authError || !user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { userId, password, name, role, sendResetEmail, email } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  if (sendResetEmail) {
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (role && !isValidRole(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Fetch existing metadata first so we merge rather than replace.
  // Replacing metadata wholesale would wipe fields we don't touch
  // (e.g. email_verified) and silently drop name or role on partial updates.
  const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId)
  const existingUserMeta = (existing?.user?.user_metadata as Record<string, unknown>) ?? {}
  const existingAppMeta  = (existing?.user?.app_metadata  as Record<string, unknown>) ?? {}

  const updates: Record<string, unknown> = {}
  if (password) updates.password = password
  if (name) updates.user_metadata = { ...existingUserMeta, name }
  // Name + role live in app_metadata (server-only) so users can't self-edit
  // them — RLS matches deal/lead ownership by app_metadata name.
  if (role || name) {
    updates.app_metadata = {
      ...existingAppMeta,
      ...(role ? { role } : {}),
      ...(name ? { name } : {}),
    }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

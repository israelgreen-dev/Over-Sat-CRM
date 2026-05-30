import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || serviceKey === 'your_service_role_key_here') {
    return null
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/admin/users — list all users
export async function GET() {
  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name ?? '',
    role: u.user_metadata?.role ?? '',
    created_at: u.created_at,
  }))

  return NextResponse.json({ users })
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { email, password, name, role } = await req.json()
  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, user: { id: data.user.id, email, name, role } })
}

// DELETE /api/admin/users — delete a user
export async function DELETE(req: NextRequest) {
  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// PATCH /api/admin/users — update name, role, or password
export async function PATCH(req: NextRequest) {
  const supabaseAdmin = adminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 })

  const { userId, password, name, role } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (password) updates.password = password
  if (name || role) updates.user_metadata = { ...(name ? { name } : {}), ...(role ? { role } : {}) }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

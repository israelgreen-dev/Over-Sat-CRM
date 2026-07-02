/**
 * api-auth.ts
 * Server-side helpers to verify incoming API requests.
 *
 * SECURITY: roles are read from app_metadata ONLY. user_metadata is editable
 * by the user themselves (supabase.auth.updateUser), so trusting it would let
 * any user self-assign admin. Migration 007 moves roles to app_metadata.
 *
 * Usage in any API route:
 *   const { user, error } = await requireAdmin(req)
 *   if (error) return NextResponse.json({ error }, { status: 401 })
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

type AuthResult =
  | { user: { id: string; email: string; role: string }; error: null }
  | { user: null; error: string }

/** Verify the Bearer token and return the caller (any authenticated user). */
export async function requireUser(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized — missing Bearer token' }
  }

  const token = authHeader.slice(7)

  // Verify the token against Supabase using the anon key (safe for this purpose)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { user: null, error: 'Unauthorized — invalid or expired token' }
  }

  const role = (user.app_metadata?.role as string) ?? ''
  return {
    user: { id: user.id, email: user.email ?? '', role },
    error: null,
  }
}

/** Verify the caller is an authenticated admin or head_of_sales. */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await requireUser(req)
  if (result.error || !result.user) return result

  if (result.user.role !== 'admin' && result.user.role !== 'head_of_sales') {
    return { user: null, error: 'Forbidden — admin or head_of_sales role required' }
  }
  return result
}

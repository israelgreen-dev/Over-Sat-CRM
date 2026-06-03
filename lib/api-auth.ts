/**
 * api-auth.ts
 * Server-side helper to verify that an incoming API request comes from
 * an authenticated user with admin or head_of_sales role.
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

/**
 * Extracts the JWT from the Authorization header, verifies it with Supabase,
 * and confirms the caller has admin or head_of_sales role.
 * Returns the user on success, or an error string on failure.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
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

  const role = (user.user_metadata?.role as string) ?? ''
  if (role !== 'admin' && role !== 'head_of_sales') {
    return { user: null, error: 'Forbidden — admin or head_of_sales role required' }
  }

  return {
    user: { id: user.id, email: user.email ?? '', role },
    error: null,
  }
}

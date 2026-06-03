import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import Dashboard from './components/Dashboard'
import { type Opportunity } from './components/OpportunitiesTable'

// Use the service role key for the server-side fetch so it bypasses RLS.
// RLS uses the anon key + user session, which isn't available server-side.
// Access is still fully gated by the Login screen client-side.
function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Cache the Supabase fetch for 60 s per deployment; purge with the
// 'opportunities' tag whenever a mutation route calls revalidateTag().
const getOpportunities = unstable_cache(
  async () => {
    const { data, error } = await serverSupabase()
      .from('opportunities')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error
    return (data ?? []) as Opportunity[]
  },
  ['opportunities-list'],
  { revalidate: 60, tags: ['opportunities'] },
)

export default async function Home() {
  let opportunities: Opportunity[]
  try {
    opportunities = await getOpportunities()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-8">
        <p className="text-sm text-red-500">Failed to load opportunities: {msg}</p>
      </main>
    )
  }

  return <Dashboard opportunities={opportunities} />
}

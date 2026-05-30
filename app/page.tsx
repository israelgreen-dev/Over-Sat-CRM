import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import Dashboard from './components/Dashboard'
import { type Opportunity } from './components/OpportunitiesTable'

// Cache the Supabase fetch for 60 s per deployment; purge with the
// 'opportunities' tag whenever a mutation route calls revalidateTag().
const getOpportunities = unstable_cache(
  async () => {
    const { data, error } = await supabase
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

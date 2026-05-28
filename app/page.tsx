import { supabase } from '@/lib/supabase'
import Dashboard from './components/Dashboard'
import { type Opportunity } from './components/OpportunitiesTable'

export default async function Home() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-8">
        <p className="text-sm text-red-500">Failed to load opportunities: {error.message}</p>
      </main>
    )
  }

  return <Dashboard opportunities={(data ?? []) as Opportunity[]} />
}

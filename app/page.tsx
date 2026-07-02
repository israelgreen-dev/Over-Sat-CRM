import Dashboard from './components/Dashboard'

// SECURITY: opportunities are fetched client-side AFTER login (Dashboard),
// through the anon key + the user's session, so RLS applies. The previous
// server-side fetch used the service-role key and embedded the full pipeline
// in the page payload before any authentication.
export default function Home() {
  return <Dashboard />
}

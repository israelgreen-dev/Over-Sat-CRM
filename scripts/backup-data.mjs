// Data backup: dump every CRM table + auth users to timestamped JSON files.
//
// Usage:  node --env-file=.env.local scripts/backup-data.mjs
//         npm run backup
//
// Output: ../Over-Sat CRM Backups/backup-YYYY-MM-DD-HH-mm-ss/<table>.json
// Retention: the newest 14 backups are kept; older ones are deleted.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS — full dump). Rows are
// fetched in pages of 1000 because PostgREST caps un-ranged selects at 1000.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const TABLES = [
  'opportunities',
  'leads',
  'notes',
  'opportunity_contacts',
  'opportunity_audit',
  'lead_audit',
  'manager_documents',
  'crm_settings',
  'client_errors',
]
const BACKUP_ROOT = path.resolve(import.meta.dirname, '..', '..', 'Over-Sat CRM Backups')
const KEEP = 14
const PAGE = 1000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)',
  )
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function fetchAll(table) {
  const all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

const stamp = new Date().toISOString().replace(/T/, '-').replace(/:/g, '-').replace(/\..+/, '')
const dir = path.join(BACKUP_ROOT, `backup-${stamp}`)
fs.mkdirSync(dir, { recursive: true })

let totalRows = 0
for (const table of TABLES) {
  const rows = await fetchAll(table)
  fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1))
  totalRows += rows.length
  console.log(`  ${table}: ${rows.length} rows`)
}

// Auth users via the admin API (paged as well).
const users = []
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`auth users: ${error.message}`)
  users.push(...data.users)
  if (data.users.length < 1000) break
}
fs.writeFileSync(path.join(dir, 'auth_users.json'), JSON.stringify(users, null, 1))
console.log(`  auth_users: ${users.length} rows`)

// Retention: keep only the newest KEEP backups.
const old = fs
  .readdirSync(BACKUP_ROOT)
  .filter((n) => n.startsWith('backup-'))
  .sort()
  .slice(0, -KEEP)
for (const name of old) {
  fs.rmSync(path.join(BACKUP_ROOT, name), { recursive: true, force: true })
  console.log(`  pruned old backup: ${name}`)
}

console.log(`BACKUP OK → ${dir} (${totalRows} table rows + ${users.length} users)`)

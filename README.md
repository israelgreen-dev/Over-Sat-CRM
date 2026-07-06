# Over-Sat CRM

Sales CRM for Over-Sat: leads → opportunities → analytics, with per-manager
permissions, targets, projections, and a full audit trail.

**Production:** https://over-sat-crm.com (Vercel project `over-sat-crm-fresh`,
auto-deploys on every push to `master`).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | Vercel (GitHub integration, auto-deploy from `master`) |
| CI | GitHub Actions — typecheck + build on every push (`.github/workflows/ci.yml`) |
| Tests | Playwright (`npm run test:e2e`, needs env vars) |

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (what CI/Vercel run)
npx tsc --noEmit     # typecheck
```

Required env vars (`.env.local`, never committed):

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…      # server-only, used by /api/admin/* and /api/manager-docs
```

## Architecture

Single-page app: `app/page.tsx` renders `Dashboard` (client component), which
owns auth state, opportunities and leads data, and switches between tabs.
**No data is fetched or embedded before login** — everything loads client-side
through the anon key + the user's session, so Postgres row-level security
applies to every read/write.

```
app/
  page.tsx                    Static shell → Dashboard
  layout.tsx, icon.svg        Metadata + favicon
  components/
    Dashboard.tsx             Auth gate, data ownership, header/nav, tab switching
    LoginScreen.tsx           Sign-in + forgot-password (PASSWORD_RECOVERY flow)
    ResetPasswordScreen.tsx   Set-new-password after a recovery link
    SetupScreen.tsx           First-login name capture (role assigned by admin)
    LeadsTab.tsx              Leads list/filters/sort + add/edit + convert-to-opportunity
    PipelineTab.tsx           Opportunities table, filters, sort, row delete
    OpportunitiesTable.tsx    Opportunity add/edit modals, product lines, contacts,
                              documents, notes, history; shared constants + helpers
    DashboardAnalytics.tsx    Dashboard tab (KPIs, leads at a glance, charts)
    AnalyticsTab.tsx          Full analytics: lead funnel, targets, planned vs actual,
                              loss review, product/country breakdowns
    ProjectionTab.tsx         Quarterly income projection + CSV report
    TargetsTab.tsx            Per-manager product targets + quarterly split
    ManagersTab.tsx           Manager cards, drill-down, documents
    SettingsTab.tsx           Managers/products/partners lists, colors, territories,
                              probability defaults
    UsersTab.tsx              User management (create/invite/edit/delete, roles)
    ManagerDocuments.tsx      Per-manager file attachments
    ErrorBoundary.tsx         Crash screen + self-hosted error reporting
  api/
    admin/users/route.ts      List/create/update/delete users (admin/HoS only)
    admin/invite/route.ts     Magic-link invitations (admin/HoS only)
    manager-docs/route.ts     Manager document upload/list/delete (authenticated)
lib/
  supabase.ts                 Browser Supabase client (anon key)
  api-auth.ts                 requireUser / requireAdmin — Bearer-token checks
  settings.ts                 CRM settings load/save (Supabase + localStorage cache)
  currency.ts                 Fixed FX rates, toUSD / fmtUSD
  rate-limit.ts               In-memory API rate limiter
supabase/migrations/          Numbered SQL migrations (run in the SQL editor)
```

## Roles & security

Roles and display names live in **`app_metadata`** (server-controlled — users
cannot edit them; assigned via the Users tab). All RLS policies and API checks
reference only `app_metadata`.

| Role | Access |
|---|---|
| `admin` | Everything, incl. Users and Settings; delete rights |
| `head_of_sales` | Everything; delete rights |
| `manager` | Own leads + own opportunities (RLS-enforced by owner name); no Targets/Settings |
| `partner` | Read-only view of data and analytics |

Key protections: pre-auth page contains no data; `/api/*` routes require
Bearer tokens and rate-limit; deletes are confirmed; every opportunity change
is recorded in `opportunity_audit` (who/when/what, via DB trigger); UI crashes
are logged to `client_errors` (admin-readable).

## Database migrations

Run in order in the Supabase SQL editor. All are idempotent (safe to re-run).

| # | What it does |
|---|---|
| 001 | Base settings table, opportunities RLS |
| 002 | Probability defaults, manager colors |
| 003 | Notes / contacts / docs RLS |
| 004 | Quarterly incomes on opportunities |
| 005 | Manager territories |
| 006 | Multi-product `product_lines` on opportunities |
| 007 | **Security:** roles → `app_metadata`, RLS rewrite |
| 008 | `updated_at` timestamps + triggers |
| 009 | Audit trail, `stage_changed_at`, client error log |
| 010 | Leads table + RLS |
| 011 | Lead source/type/priority/website; type on opportunities; audit update |
| 012 | Lead contact title + LinkedIn |
| 013 | Website/source/priority on opportunities |
| 014 | **Security:** names → `app_metadata`, ownership RLS rewrite |

## Deploying

Push to `master` → GitHub Actions runs typecheck+build → Vercel auto-builds
and deploys to production. Manual deploy: `npx vercel --prod`.

If a migration accompanies a code change, run the migration first (the app
degrades gracefully — unknown columns are stripped from writes — but features
stay dormant until the migration runs).

## Backup & restore

- **Database:** Supabase Dashboard → Database → Backups (verify schedule; take
  a manual export before risky changes). Schema is reproducible from
  `supabase/migrations/`.
- **Code:** GitHub (`israelgreen-dev/Over-Sat-CRM`); releases tagged (`v1.0.0`).
- **Files:** manager documents live in the Supabase Storage bucket `manager-docs`.
- **Data exports:** Opportunities CSV (header button) and Projection CSV
  (Projection tab) for point-in-time business snapshots.

## Operational notes

- Auth emails (invites, password resets) use Supabase's shared sender until
  custom SMTP is configured: Supabase → Authentication → SMTP settings.
- Fixed FX rates in `lib/currency.ts` — update when rates move materially.
- E2E job in CI is scaffolded but disabled until repository secrets are added
  (see `.github/workflows/ci.yml`).

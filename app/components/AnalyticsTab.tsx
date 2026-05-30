'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  FunnelChart, Funnel, LabelList,
} from 'recharts'
import { type Opportunity } from './OpportunitiesTable'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function winVal(o: Opportunity) { return (o as any).final_win_value || o.value || 0 }
function pipeVal(o: Opportunity) { return o.value ?? 0 }
function pct(num: number, den: number) { return den > 0 ? Math.round((num / den) * 100) : 0 }

const STAGE_COLORS: Record<string, string> = {
  Discovery: '#3b82f6', Proposal: '#f59e0b', Negotiation: '#f97316', Win: '#10b981', Loss: '#ef4444',
}
const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']
const STATUS_COLORS: Record<string, string> = { 'On Track': '#10b981', 'Risk': '#f59e0b', 'Critical': '#ef4444', 'No Status': '#94a3b8' }

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function KPI({ label, value, sub, color = 'text-slate-900', bg = 'bg-gray-50' }: { label: string; value: string; sub?: string; color?: string; bg?: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 ${bg} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-sm text-gray-400">No data for this period.</p>
}

export default function AnalyticsTab({
  opportunities,
  managers,
  managerTargets,
  managerColors,
  selectedYear,
}: {
  opportunities: Opportunity[]
  managers: string[]
  managerTargets: Record<string, number>
  managerColors: Record<string, string>
  selectedYear: string
}) {
  const opps   = opportunities
  const wins   = opps.filter((o) => o.stage === 'Win')
  const losses = opps.filter((o) => o.stage === 'Loss')
  const active = opps.filter((o) => !['Win', 'Loss'].includes(o.stage))

  const totalPipeline  = active.reduce((s, o) => s + pipeVal(o), 0)
  const totalWin       = wins.reduce((s, o) => s + winVal(o), 0)
  const totalForecast  = opps.reduce((s, o) => s + pipeVal(o), 0)
  const totalLostValue = losses.reduce((s, o) => s + pipeVal(o), 0)
  const overallTarget  = Object.values(managerTargets).reduce((s, v) => s + v, 0)
  const achievementPct = pct(totalWin, overallTarget)
  const winRateCount   = pct(wins.length, opps.length)
  const winRateValue   = pct(totalWin, totalForecast)
  const avgWin         = wins.length > 0 ? totalWin / wins.length : 0
  const avgLoss        = losses.length > 0 ? totalLostValue / losses.length : 0

  // Stage data
  const STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Win', 'Loss']
  const stageData = STAGES.map((stage) => {
    const s = opps.filter((o) => o.stage === stage)
    const val = stage === 'Win' ? s.reduce((a, o) => a + winVal(o), 0) : s.reduce((a, o) => a + pipeVal(o), 0)
    return { stage, count: s.length, value: val }
  })
  const maxStageVal = Math.max(...stageData.map((d) => d.value), 1)

  // Funnel
  const funnelData = ['Discovery', 'Proposal', 'Negotiation', 'Win'].map((stage) => ({
    name: stage, value: opps.filter((o) => o.stage === stage).length, fill: STAGE_COLORS[stage],
  }))

  // Loss reasons
  const lossMap: Record<string, number> = {}
  losses.forEach((o) => { const r = o.loss_reason ?? 'Unknown'; lossMap[r] = (lossMap[r] ?? 0) + 1 })
  const lossData = Object.entries(lossMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

  // Product
  const prodMap: Record<string, { count: number; value: number; winCount: number; winValue: number }> = {}
  opps.forEach((o) => {
    const p = (o.product as string) || 'Unspecified'
    if (!prodMap[p]) prodMap[p] = { count: 0, value: 0, winCount: 0, winValue: 0 }
    prodMap[p].count++; prodMap[p].value += pipeVal(o)
    if (o.stage === 'Win') { prodMap[p].winCount++; prodMap[p].winValue += winVal(o) }
  })
  const prodData = Object.entries(prodMap).map(([product, d]) => ({ product, ...d, winRate: pct(d.winCount, d.count) })).sort((a, b) => b.value - a.value)

  // Country
  const cntryMap: Record<string, { count: number; value: number; wins: number }> = {}
  opps.forEach((o) => {
    const c = (o as any).country || 'Unknown'
    if (!cntryMap[c]) cntryMap[c] = { count: 0, value: 0, wins: 0 }
    cntryMap[c].count++; cntryMap[c].value += pipeVal(o)
    if (o.stage === 'Win') cntryMap[c].wins++
  })
  const cntryData = Object.entries(cntryMap).map(([country, d]) => ({ country, ...d })).sort((a, b) => b.value - a.value).slice(0, 10)

  // Quarterly
  const qtrMap: Record<string, { pipeline: number; win: number; count: number }> = {}
  opps.forEach((o) => {
    const q = (o as any).close_date || 'No Date'
    if (!qtrMap[q]) qtrMap[q] = { pipeline: 0, win: 0, count: 0 }
    qtrMap[q].count++; qtrMap[q].pipeline += pipeVal(o)
    if (o.stage === 'Win') qtrMap[q].win += winVal(o)
  })
  const qtrData = Object.entries(qtrMap).map(([quarter, d]) => ({ quarter, ...d })).sort((a, b) => a.quarter.localeCompare(b.quarter))

  // Status
  const statusMap: Record<string, number> = {}
  active.forEach((o) => { const s = (o as any).status || 'No Status'; statusMap[s] = (statusMap[s] ?? 0) + 1 })
  const statusData = Object.entries(statusMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

  // Manager performance — only managers defined in Settings.
  const mgrData = managers.map((name, i) => {
    const m = opps.filter((o) => (o.owner as string)?.toLowerCase() === name.toLowerCase())
    const w = m.filter((o) => o.stage === 'Win')
    const a = m.filter((o) => !['Win', 'Loss'].includes(o.stage))
    const winAmt   = w.reduce((s, o) => s + winVal(o), 0)
    const pipeline = a.reduce((s, o) => s + pipeVal(o), 0)
    const target   = managerTargets[name] ?? 0
    const gap      = target - winAmt
    const rate     = pct(w.length, m.length)
    const color    = managerColors[name] ?? PALETTE[i % PALETTE.length]
    return { name, winAmt, pipeline, target, gap, winCount: w.length, lossCount: m.filter((o) => o.stage === 'Loss').length, total: m.length, rate, color }
  }).sort((a, b) => b.winAmt - a.winAmt)

  const barData = mgrData.map((m) => ({ name: m.name, Target: m.target, Win: m.winAmt, Pipeline: m.pipeline }))

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-base font-bold text-gray-900">Analytics — {selectedYear}</h2>
        <p className="mt-0.5 text-sm text-gray-400">Full pipeline and performance intelligence for {selectedYear}.</p>
      </div>

      {/* ── Executive Summary ─────────────────────────────────────────────── */}
      <Section title="Executive Summary" subtitle={`${opps.length} opportunities in ${selectedYear}`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Overall Target"   value={fmtShort(overallTarget)}  sub="annual team quota" />
          <KPI label="Total Win"        value={fmtShort(totalWin)}        sub={`${wins.length} deals`}   color="text-green-600" bg="bg-green-50" />
          <KPI label="Achievement"      value={`${achievementPct}%`}      sub="Win vs Target"    color={achievementPct >= 100 ? 'text-green-600' : achievementPct >= 70 ? 'text-amber-500' : 'text-red-500'} />
          <KPI label="Gap to Target"    value={fmtShort(Math.abs(overallTarget - totalWin))} sub={overallTarget - totalWin <= 0 ? 'Target exceeded ✓' : 'remaining'} color={overallTarget - totalWin <= 0 ? 'text-green-600' : 'text-red-500'} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Open Pipeline"    value={fmtShort(totalPipeline)}  sub={`${active.length} active deals`} />
          <KPI label="Win Rate (count)" value={`${winRateCount}%`}        sub={`${wins.length} of ${opps.length}`} />
          <KPI label="Win Rate (value)" value={`${winRateValue}%`}        sub="won vs total pipeline" />
          <KPI label="Avg. Win Value"   value={fmtShort(avgWin)}          sub="per won deal" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Total Lost"       value={fmtShort(totalLostValue)} sub={`${losses.length} deals`}  color="text-red-500" />
          <KPI label="Avg. Loss Value"  value={fmtShort(avgLoss)}         sub="per lost deal"            color="text-red-500" />
          <KPI label="Total Forecast"   value={fmtShort(totalForecast)}   sub="all deals incl. active" />
          <KPI label="Opportunities"    value={String(opps.length)}        sub={`${active.length} active · ${wins.length} won · ${losses.length} lost`} />
        </div>
      </Section>

      {/* ── Achievement per manager ───────────────────────────────────────── */}
      <Section title="Annual Target Achievement" subtitle="Win progress vs quota per manager">
        {mgrData.length === 0 ? <Empty /> : (
          <div className="space-y-4">
            {mgrData.filter((m) => m.target > 0 || m.winAmt > 0).map((m) => (
              <div key={m.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-900">{m.name}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-600 font-semibold">{fmtShort(m.winAmt)} won</span>
                    <span className="text-gray-400">of {fmtShort(m.target)} target</span>
                    <span className="font-bold" style={{ color: m.color }}>{pct(m.winAmt, m.target || 1)}%</span>
                  </div>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${Math.min(pct(m.winAmt, m.target || 1), 100)}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Target vs Win vs Pipeline by Manager">
          {mgrData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barGap={3} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Target"   fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Win"      fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pipeline" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Sales Funnel" subtitle="Active deals count per stage">
          {opps.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <FunnelChart>
                <Tooltip formatter={(v) => [`${v} deals`]} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="name" style={{ fontSize: 12, fontWeight: 600 }} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Pipeline by Stage ─────────────────────────────────────────────── */}
      <Section title="Pipeline by Stage" subtitle="Value and count per stage">
        {opps.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {stageData.map(({ stage, count, value }) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-right"><span className="text-xs font-semibold text-gray-700">{stage}</span></div>
                <div className="flex-1">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(value / maxStageVal) * 100}%`, backgroundColor: STAGE_COLORS[stage] ?? '#94a3b8' }} />
                  </div>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <span className="text-sm font-bold text-gray-900">{fmtFull(value)}</span>
                  <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Quarterly ─────────────────────────────────────────────────────── */}
      <Section title="Quarterly Pipeline & Win" subtitle="Pipeline and won value by expected close quarter">
        {qtrData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={qtrData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="pipeline" name="Pipeline" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="win"      name="Win"      fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Win/Loss + Status ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Win vs Loss vs Active">
          {opps.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={[{ name: 'Won', value: wins.length }, { name: 'Lost', value: losses.length }, { name: 'Active', value: active.length }]} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  <Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#3b82f6" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Loss Reasons">
          {lossData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={lossData} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} name="Deals" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Active Deals by Status">
          {statusData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData.map((s) => ({ name: s.status, value: s.count }))} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {statusData.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] ?? PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Product breakdown ─────────────────────────────────────────────── */}
      <Section title="Performance by Product" subtitle="Pipeline, wins, and win rate per product">
        {prodData.length === 0 ? <Empty /> : (
          <>
            <div className="mb-3 grid grid-cols-6 gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-2">Product</div>
              <div className="text-right">Pipeline</div>
              <div className="text-right">Win Value</div>
              <div className="text-right">Deals</div>
              <div className="text-right">Win Rate</div>
            </div>
            <div className="space-y-2">
              {prodData.map(({ product, value, winValue, count, winRate }, i) => (
                <div key={product} className="grid grid-cols-6 gap-2 items-center rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{product}</span>
                  </div>
                  <div className="text-right text-sm text-gray-700">{fmtShort(value)}</div>
                  <div className="text-right text-sm font-semibold text-green-600">{fmtShort(winValue)}</div>
                  <div className="text-right text-sm text-gray-500">{count}</div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${winRate >= 50 ? 'bg-green-100 text-green-700' : winRate > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{winRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ── Country + Leaderboard ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Pipeline by Country" subtitle="Top 10 countries by deal value">
          {cntryData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {cntryData.map(({ country, count, value, wins: w }, i) => (
                <div key={country} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900">{country}</span>
                  <span className="text-xs text-green-600 font-semibold">{w} won</span>
                  <span className="text-sm font-bold text-gray-900 w-20 text-right">{fmtShort(value)}</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{count} deals</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Manager Leaderboard" subtitle="Ranked by total win value">
          {mgrData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {mgrData.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.total} deals · {m.rate}% win rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{fmtShort(m.winAmt)}</p>
                    <p className="text-xs text-gray-400">{fmtShort(m.pipeline)} active</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Full manager table ────────────────────────────────────────────── */}
      <Section title="Full Manager Performance Table" subtitle="Complete breakdown per sales manager">
        {mgrData.length === 0 ? <Empty /> : (
          <>
            <div className="mb-3 grid grid-cols-8 gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-2">Manager</div>
              <div className="text-right">Target</div>
              <div className="text-right">Win</div>
              <div className="text-right">Gap</div>
              <div className="text-right">Pipeline</div>
              <div className="text-right">Win Rate</div>
              <div className="text-right">Deals</div>
            </div>
            <div className="space-y-2">
              {mgrData.map((m) => (
                <div key={m.name} className="grid grid-cols-8 gap-2 items-center rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="col-span-2 text-sm font-semibold text-gray-900">{m.name}</div>
                  <div className="text-right text-sm text-gray-500">{m.target > 0 ? fmtShort(m.target) : '—'}</div>
                  <div className="text-right text-sm font-semibold text-green-600">{fmtShort(m.winAmt)}</div>
                  <div className={`text-right text-sm font-semibold ${m.gap <= 0 ? 'text-green-600' : 'text-red-500'}`}>{m.gap <= 0 ? '✓' : fmtShort(m.gap)}</div>
                  <div className="text-right text-sm text-gray-700">{fmtShort(m.pipeline)}</div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.rate >= 50 ? 'bg-green-100 text-green-700' : m.rate > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{m.rate}%</span>
                  </div>
                  <div className="text-right text-sm text-gray-500">{m.total}</div>
                </div>
              ))}
              <div className="grid grid-cols-8 gap-2 items-center border-t border-gray-200 pt-3 mt-1">
                <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gray-400">Total</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(overallTarget)}</div>
                <div className="text-right text-sm font-bold text-green-600">{fmtShort(mgrData.reduce((s, m) => s + m.winAmt, 0))}</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(Math.abs(mgrData.reduce((s, m) => s + m.gap, 0)))}</div>
                <div className="text-right text-sm font-bold text-gray-700">{fmtShort(mgrData.reduce((s, m) => s + m.pipeline, 0))}</div>
                <div />
                <div className="text-right text-sm font-bold text-gray-500">{opps.length}</div>
              </div>
            </div>
          </>
        )}
      </Section>

    </div>
  )
}

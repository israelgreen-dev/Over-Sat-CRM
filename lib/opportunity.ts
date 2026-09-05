// Pure opportunity domain model: types, probability math, product lines,
// quarter helpers, and the shared option lists used by both the leads and
// opportunities entry paths. No React, no Supabase — safe to import anywhere.
// (Extracted from OpportunitiesTable.tsx, which had grown into a de-facto
// shared module imported by 8 files.)

export type Opportunity = {
  id: string | number
  name: string
  customer_name: string
  stage: string
  product: string | null
  owner: string | null
  value: number | null
  loss_reason: string | null
  loss_description: string | null
  // Columns added by later migrations (004, 006, 008, 009, 013). All optional
  // because rows created before each migration may return them as null/absent.
  status?: string | null
  country?: string | null
  opportunity_type?: string | null
  website?: string | null
  source?: string | null
  priority?: string | null
  currency?: string | null
  close_date?: string | null
  final_win_value?: number | null
  probability?: number | null
  product_lines?: ProductLine[] | null
  quarterly_incomes?: Record<string, number> | null
  created_at?: string | null
  updated_at?: string | null
  stage_changed_at?: string | null
  /** Next follow-up date (yyyy-mm-dd), migration 017. */
  follow_up_at?: string | null
}

// Default probability by stage (used when probability is not explicitly set).
// These are the factory values — the admin can override them in Settings,
// in which case the overrides are passed down as the `defaults` argument.
export const DEFAULT_PROBABILITY: Record<string, number> = {
  Discovery: 10,
  Proposal: 25,
  Negotiation: 60,
  Win: 100,
  Loss: 0,
}

export function effectiveProbability(
  o: Opportunity,
  defaults: Record<string, number> = DEFAULT_PROBABILITY,
): number {
  const p = o.probability
  if (p !== null && p !== undefined) return Number(p)
  return defaults[o.stage] ?? 0
}

export function weightedValue(
  o: Opportunity,
  defaults: Record<string, number> = DEFAULT_PROBABILITY,
): number {
  return ((o.value ?? 0) * effectiveProbability(o, defaults)) / 100
}

// ── Product line items ──────────────────────────────────────────────────────
// An opportunity can consist of several products, each with its own quantity
// and unit price. The opportunity's `value` stays the sum of the line totals.
export type ProductLine = { id: string; product: string; quantity: number; price: number }

export function newProductLine(product = '', price = 0, quantity = 1): ProductLine {
  return {
    id: Math.random().toString(36).slice(2),
    product,
    quantity: Math.max(1, quantity),
    price: Math.max(0, price),
  }
}
export function lineTotal(l: ProductLine): number {
  return (l.price || 0) * (l.quantity || 0)
}
export function linesTotal(lines: ProductLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0)
}

// Read product lines off an opportunity, synthesizing a single line from the
// legacy `product` + `value` for opportunities saved before multi-product.
export function getProductLines(opp: Opportunity): ProductLine[] {
  const raw = opp.product_lines
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((l) =>
      newProductLine(l?.product ?? '', Number(l?.price) || 0, Number(l?.quantity) || 1),
    )
  }
  const p = (opp.product as string) ?? ''
  return p ? [newProductLine(p, Number(opp.value) || 0, 1)] : []
}
export function productSummary(lines: ProductLine[]): string {
  return lines
    .map((l) => l.product)
    .filter(Boolean)
    .join(', ')
}

// ── Quarter helpers ─────────────────────────────────────────────────────────

export function generateQuarters(count = 8): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const quarters: string[] = []
  let q = currentQ,
    y = year
  for (let i = 0; i < count; i++) {
    quarters.push(`Q${q}-${y}`)
    if (++q > 4) {
      q = 1
      y++
    }
  }
  return quarters
}

// Generate `count` quarters starting from a "Qn-YYYY" string (e.g. the deal's
// close date). Falls back to the current-quarter window when no/invalid start.
export function generateQuartersFrom(start: string | null | undefined, count = 8): string[] {
  const m = String(start ?? '').match(/Q([1-4])-(\d{4})/)
  if (!m) return generateQuarters(count)
  let q = Number(m[1]),
    y = Number(m[2])
  const quarters: string[] = []
  for (let i = 0; i < count; i++) {
    quarters.push(`Q${q}-${y}`)
    if (++q > 4) {
      q = 1
      y++
    }
  }
  return quarters
}

// ── Shared option lists ─────────────────────────────────────────────────────

// What kind of buyer the deal is with — set on the lead and carried over on
// conversion; editable on the opportunity itself.
export const OPPORTUNITY_TYPES = [
  'Direct Customer',
  'Partner',
  'Distributor',
  'Integrator',
  'Government',
  'Military',
  'Law Enforcement',
] as const

// Shared by leads and opportunities so both entry paths capture equal data.
export const LEAD_SOURCES = [
  'Website',
  'Exhibition',
  'Partner',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Existing Customer',
  'Distributor',
  'Other',
] as const

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export const PRIORITY_ICONS: Record<string, string> = { High: '🔴', Medium: '🟡', Low: '🟢' }

export const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo (Republic)',
  'Congo (Democratic Republic)',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'São Tomé and Príncipe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
]

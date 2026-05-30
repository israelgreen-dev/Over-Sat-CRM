// Fixed USD exchange rates. Update these values when rates shift significantly.
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,  // 1 EUR → USD
  ILS: 0.27,  // 1 ILS → USD  (≈ 3.7 ILS per USD)
}

/** Convert any supported currency amount to its USD equivalent. */
export function toUSD(value: number, currency = 'USD'): number {
  return value * (EXCHANGE_RATES[currency] ?? 1)
}

// Single Intl instance — always formats in USD.
const _fmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

/** Format a value (in any supported currency) as a USD string. */
export function fmtUSD(value: number, currency = 'USD'): string {
  return _fmt.format(toUSD(value, currency))
}

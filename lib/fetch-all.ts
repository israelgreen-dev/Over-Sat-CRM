import { supabase } from './supabase'

const PAGE = 1000

/**
 * Fetch every row of a table, paging in blocks of 1000.
 *
 * Why: PostgREST silently caps un-ranged selects at 1000 rows, so a plain
 * `select('*')` starts truncating the moment a table grows past that —
 * without any error. This helper walks `.range()` pages until a short page
 * signals the end, so callers always get the complete result set.
 */
export async function fetchAllRows<T>(
  table: string,
  orderBy: string,
  opts: { ascending?: boolean } = {},
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: opts.ascending ?? true })
      .range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    all.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return { data: all, error: null }
}

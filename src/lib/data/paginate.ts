import type { PostgrestError } from "@supabase/supabase-js";

/** Supabase's API returns at most this many rows a request (`db-max-rows`). */
const PAGE = 1000;

/**
 * Every row of a read that can outgrow one response, a page at a time. A
 * read past the cap is cut off silently, and which end goes missing depends
 * on the order: the newest sessions, for a history read oldest first. `page`
 * builds the query for one range; it must order by something unique (add
 * the id last), or a row can land on two pages or none.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

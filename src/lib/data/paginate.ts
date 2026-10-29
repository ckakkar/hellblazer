import type { PostgrestError } from "@supabase/supabase-js";

/** Rows asked for a request: Supabase's API returns at most 1,000 (`db-max-rows`). */
const PAGE = 1000;

/**
 * Every row of a read that can outgrow one response, a page at a time. A
 * read past the cap is cut off silently, and which end goes missing depends
 * on the order: the newest sessions, for a history read oldest first. `page`
 * builds the query for one range; it must order by something unique (add
 * the id last), or a row can land on two pages or none.
 *
 * It doesn't trust the cap to be 1,000: each page starts where the last one
 * ended, and a short page is only the end once a one-row look past it comes
 * back empty, so a lower cap pages on instead of truncating.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const got = data ?? [];
    rows.push(...got);
    if (got.length === 0) return rows;
    from += got.length;
    if (got.length < PAGE) {
      const { data: more, error: moreError } = await page(from, from);
      if (moreError) throw moreError;
      if (!more?.length) return rows;
    }
  }
}

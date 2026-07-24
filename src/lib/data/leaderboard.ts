import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";

export type LeaderboardEntry = {
  username: string;
  totalVolumeKg: number;
  tierKey: string | null;
  name: string | null;
  epithet: string | null;
  rank: number | null;
};

/**
 * The global standings — every lifter who has claimed a ring name, ranked by
 * lifetime working-set volume moved (strongest mover first). Reads through the
 * `leaderboard()` security-definer RPC, which exposes only username, tier and
 * total volume across all users (no other private data).
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard");
  if (error) throw error;

  const entries: LeaderboardEntry[] = [];
  for (const row of data ?? []) {
    if (!row.username) continue;
    const tier = getTier(row.tier);
    entries.push({
      username: row.username,
      totalVolumeKg: Number(row.total_volume ?? 0),
      tierKey: tier?.key ?? null,
      name: tier?.name ?? null,
      epithet: tier?.epithet ?? null,
      rank: tier?.rank ?? null,
    });
  }
  // Most tonnage first; ties broken alphabetically for a stable order.
  entries.sort(
    (a, b) =>
      b.totalVolumeKg - a.totalVolumeKg || a.username.localeCompare(b.username),
  );
  return entries;
}

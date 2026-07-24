import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";

export type LeaderboardEntry = {
  username: string;
  tierKey: string;
  name: string;
  epithet: string;
  rank: number;
};

/**
 * The global standings — every lifter who has claimed a ring name and a rank,
 * strongest first. Reads through the `leaderboard()` security-definer RPC, which
 * exposes only username + tier (no private data) across all users.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard");
  if (error) throw error;

  const entries: LeaderboardEntry[] = [];
  for (const row of data ?? []) {
    const tier = getTier(row.tier);
    if (!row.username || !tier) continue;
    entries.push({
      username: row.username,
      tierKey: tier.key,
      name: tier.name,
      epithet: tier.epithet,
      rank: tier.rank,
    });
  }
  // Strongest first; ties broken alphabetically for a stable order.
  entries.sort((a, b) => b.rank - a.rank || a.username.localeCompare(b.username));
  return entries;
}

import Link from "next/link";
import { Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/data/leaderboard";
import { getProfile } from "@/lib/data/profile";
import { getUnit } from "@/lib/settings";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Standings } from "./standings";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [entries, profile, unit] = await Promise.all([
    getLeaderboard(),
    getProfile(),
    getUnit(),
  ]);
  const me = profile?.username?.toLowerCase() ?? null;
  const myPlace = me
    ? entries.findIndex((e) => e.username.toLowerCase() === me) + 1
    : 0;

  return (
    <div>
      <PageHeader
        title="King of the Hill"
        subtitle="Every fighter with a ring name, ranked by total volume moved."
      />

      {!profile?.username && (
        <Card className="mb-4 flex flex-col items-start gap-3 border-accent/20 bg-accent/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <div className="text-sm font-medium text-text">
                Claim your ring name
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Set a ring name in your profile to take your place among the
                fighters.
              </p>
            </div>
          </div>
          <Link href="/settings" className="shrink-0">
            <Button variant="secondary">Go to Profile</Button>
          </Link>
        </Card>
      )}

      {myPlace > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Your standing
          <span className="font-impact text-sm leading-none text-accent">
            #{myPlace}
          </span>
          <span className="text-muted/60">of {entries.length}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="No fighters ranked yet"
          body="Be the first: set a ring name and log some working sets."
        />
      ) : (
        <Standings entries={entries} me={me} unit={unit} />
      )}
    </div>
  );
}

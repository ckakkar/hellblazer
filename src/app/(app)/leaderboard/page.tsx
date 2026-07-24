import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/data/leaderboard";
import { getProfile } from "@/lib/data/profile";
import { getUnit } from "@/lib/settings";
import { formatVolume } from "@/lib/units";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        title="Leaderboard"
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
        <div className="mb-4 px-1 font-mono text-xs uppercase tracking-wide text-muted">
          You&apos;re <span className="text-accent">#{myPlace}</span> of{" "}
          {entries.length}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="No fighters ranked yet"
          body="Be the first — set a ring name and log some working sets."
        />
      ) : (
        <ol className="grid gap-2">
          {entries.map((e, i) => {
            const place = i + 1;
            const isMe = me != null && e.username.toLowerCase() === me;
            return (
              <li key={`${e.username}-${i}`}>
                <Card
                  className={cn(
                    "flex items-center gap-3.5 p-4 transition-colors",
                    isMe
                      ? "border-accent/50 bg-accent/[0.05]"
                      : "hover:border-accent/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full border",
                      place === 1
                        ? "border-accent/50 bg-accent/10"
                        : "border-border bg-surface-2",
                    )}
                  >
                    {place === 1 ? (
                      <Crown className="size-5 text-accent" />
                    ) : (
                      <span
                        className={cn(
                          "font-impact text-base tabular-nums leading-none",
                          place <= 3 ? "text-text" : "text-muted/70",
                        )}
                      >
                        {place}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text">
                        {e.username}
                      </span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-bg">
                          You
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-xs text-muted">
                      {e.name ? `${e.name} · ${e.epithet}` : "Unranked fighter"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-text">
                      {formatVolume(e.totalVolumeKg, unit)}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted/70">
                      total moved
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

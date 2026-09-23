import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/data/leaderboard";
import { getProfile } from "@/lib/data/profile";
import { getUnit } from "@/lib/settings";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Standings } from "./standings";

export const metadata: Metadata = { title: "King of the Hill" };

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
        subtitle="Everyone with a ring name, ranked by total volume lifted."
        stat={
          myPlace > 0
            ? { value: `#${myPlace}`, label: `of ${entries.length}` }
            : { value: entries.length, label: entries.length === 1 ? "lifter" : "lifters" }
        }
      />

      {!profile?.username && (
        <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-text">
              You&apos;re not on the board
            </h2>
            <p className="mt-0.5 text-[14px] text-muted">
              Pick a ring name and your volume joins the standings.
            </p>
          </div>
          <Link href="/settings" className="shrink-0">
            <Button variant="secondary">Pick a ring name</Button>
          </Link>
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

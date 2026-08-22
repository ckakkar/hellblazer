import { TIERS, type Tier } from "@/lib/tiers";
import { ProfileAvatar } from "./profile-avatar";
import { cn } from "@/lib/utils";

/* ── Profile identity ──────────────────────────────────────────────────────
   A profile screen should open by showing you who you are. This one opened
   with the word "Profile" and a subtitle, which is a document heading, not an
   identity — so the header is now the lifter: their picture, the name they
   fight under, and the rung they currently hold.

   The avatar comes from the Google account, since that is the only sign-in
   method; the fallback is the first letter set in the display face rather than
   a generic silhouette icon. */
export function ProfileIdentity({
  name,
  ringName,
  email,
  avatarUrl,
  tier,
  className,
}: {
  name: string | null;
  ringName: string | null;
  email: string | null;
  avatarUrl: string | null;
  tier: Tier | null | undefined;
  className?: string;
}) {
  const shown = name ?? ringName ?? email?.split("@")[0] ?? "Unnamed lifter";
  const initial = shown.trim().charAt(0).toUpperCase() || "?";
  const rank = tier?.rank ?? 0;

  return (
    <section className={cn("relative", className)}>
      <div className="flex items-center gap-4">
        <ProfileAvatar src={avatarUrl} initial={initial} />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-impact text-3xl uppercase leading-none text-text sm:text-4xl">
            {shown}
          </h1>
          <p className="mt-1.5 truncate font-mono text-[11px] text-muted">
            {ringName ? `@${ringName}` : email}
          </p>
        </div>
      </div>

      {/* The rung, restated here because this is the screen where you change it. */}
      <div className="mt-5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {tier ? `Rank ${String(rank).padStart(2, "0")}` : "Unranked"}
        </span>
        <span
          className={cn(
            "min-w-0 truncate font-display text-sm uppercase tracking-wide",
            tier ? "text-accent" : "text-muted",
          )}
        >
          {tier ? tier.name : "Not yet weighed in"}
        </span>
      </div>
      <div className="mt-2 flex gap-[3px]">
        {TIERS.map((t) => (
          <span
            key={t.key}
            className={cn(
              "h-1.5 flex-1",
              t.rank <= rank ? "bg-accent" : "bg-surface-2",
            )}
          />
        ))}
      </div>
    </section>
  );
}

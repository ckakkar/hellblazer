import { formatFighterNumber, TIERS, type Tier } from "@/lib/tiers";
import { FighterArt } from "./fighter-art";
import { ProfileAvatar } from "./profile-avatar";
import { cn } from "@/lib/utils";

/* ── Profile identity ──────────────────────────────────────────────────────
   A profile screen should open by showing you who you are. This one opened
   with the word "Profile" and a subtitle, which is a document heading, not an
   identity, so the header is now the lifter: their picture, the name they
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
    <section
      className={cn(
        "hb-ink-noise relative isolate min-h-[19rem] overflow-hidden border-y-2 border-text/80 bg-surface/55 px-5 py-6 sm:px-7 sm:py-8",
        className,
      )}
    >
      {tier && (
        <FighterArt
          fighterKey={tier.key}
          variant="card"
          className="absolute inset-y-0 right-[-8%] w-[64%] opacity-55 sm:right-0 sm:w-[52%]"
          imageClassName="scale-[1.04] object-[center_18%]"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/5" />
      <div className="relative z-10 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.26em] text-accent">
        <span className="h-px w-8 bg-accent" />
        Fighter profile
        <span className="text-muted/60">file 09</span>
      </div>

      <div className="relative z-10 mt-14 flex max-w-[78%] items-end gap-4 sm:max-w-[64%]">
        <ProfileAvatar src={avatarUrl} initial={initial} />
        <div className="min-w-0 flex-1 pb-0.5">
          <h1 className="font-impact text-4xl uppercase leading-[0.82] text-text sm:text-6xl">
            {shown}
          </h1>
          <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {ringName ? `@${ringName}` : email}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-8 flex max-w-[82%] items-end justify-between gap-4 sm:max-w-[68%]">
        <span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">Official rank</span>
          <span className="mt-1 block font-impact text-3xl leading-none tabular-nums text-text">
            {tier ? formatFighterNumber(rank) : "00"}
          </span>
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-right font-display text-sm uppercase tracking-[0.1em]",
            tier ? "text-accent" : "text-muted",
          )}
        >
          {tier ? tier.name : "Not yet weighed in"}
        </span>
      </div>
      <div className="relative z-10 mt-3 flex max-w-[82%] gap-[3px] sm:max-w-[68%]">
        {TIERS.map((t) => (
          <span
            key={t.key}
            className={cn(
              "h-1 flex-1 skew-x-[-12deg]",
              t.rank <= rank ? "bg-accent" : "bg-surface-2",
            )}
          />
        ))}
      </div>
    </section>
  );
}

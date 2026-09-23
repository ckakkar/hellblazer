import { ProfileAvatar } from "./profile-avatar";
import { FighterArt } from "./fighter-art";
import { cn } from "@/lib/utils";
import { MAX_RANK, type Tier } from "@/lib/tiers";

/* The profile opens on who you are, laid out like a fighter's page: your
   rank fighter as a banner (edge to edge and up under the top bar on a
   phone, like the home hero), your picture overlapping its foot, then name,
   ring name and rank. The avatar comes from the Google account, the only
   sign-in method; the fallback is the initial. */
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

  return (
    <header className={className}>
      <div className="hb-hero-bleed relative isolate h-48 overflow-hidden rounded-3xl [--hb-fade:var(--color-bg)] md:h-44">
        <div className="hb-hero-art absolute inset-0 -z-10 md:left-auto md:w-[58%]">
          <FighterArt
            fighterKey={tier?.key ?? "ohma"}
            variant="hero"
            priority
            fade="bottom"
            className="absolute inset-0"
            imageClassName={cn("object-[center_16%]", tier ? "opacity-75" : "opacity-40 grayscale")}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden md:block"
            style={{ background: "linear-gradient(to right, var(--color-bg), transparent 55%)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-screen"
            style={{
              background:
                "radial-gradient(70% 70% at 70% 20%, rgb(var(--accent-rgb) / 0.2), transparent 70%)",
            }}
          />
        </div>
      </div>
      <ProfileAvatar
        src={avatarUrl}
        initial={initial}
        className="relative -mt-11 ml-1 size-[5.5rem] text-[2rem] ring-4 ring-bg"
      />
      <h1 className="hb-hero-rise font-display mt-3 truncate px-1 text-[2rem] leading-tight text-text sm:text-[2.5rem]">
        {shown}
      </h1>
      <p className="hb-hero-rise mt-1 flex min-w-0 items-center gap-2 px-1 text-[15px] text-muted" style={{ animationDelay: "60ms" }}>
        {tier && (
          <span className="tnum shrink-0 rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-black">
            Rank {tier.rank} of {MAX_RANK}
          </span>
        )}
        <span className="truncate">
          {[tier?.name, ringName ? `@${ringName}` : email].filter(Boolean).join(", ")}
        </span>
      </p>
    </header>
  );
}

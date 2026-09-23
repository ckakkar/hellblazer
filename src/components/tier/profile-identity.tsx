import { ProfileAvatar } from "./profile-avatar";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/tiers";

/* The profile opens on who you are: picture, name, ring name. Rank lives in
   the section below (and on the dashboard), so it isn't repeated here. The
   avatar comes from the Google account, the only sign-in method; the
   fallback is the initial. */
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
    <header className={cn("flex items-center gap-4", className)}>
      <ProfileAvatar src={avatarUrl} initial={initial} />
      <div className="min-w-0">
        <h1 className="font-display truncate text-[2rem] leading-tight text-text sm:text-[2.5rem]">
          {shown}
        </h1>
        <p className="truncate text-[15px] text-muted">
          {ringName ? `@${ringName}` : email}
          {tier ? `, ${tier.name}` : ""}
        </p>
      </div>
    </header>
  );
}

import { ProfileAvatar } from "./profile-avatar";
import { FighterArt } from "./fighter-art";
import { MAX_RANK, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** One measurement on the tale of the tape: "Height 180 cm". */
export type TapeFigure = { label: string; value: string | null; unit?: string };

/* The profile opens on the lifter's file, the way a fight programme brings a
   fighter on: their rank fighter's portrait on a black plate (in either
   theme), faded into it from the right; their own name across the plate in
   the wide cut, first name over the rest; and under it the tale of the tape,
   the measurements read out before a bout. The account picture, when there
   is one, is a small mark beside the ring name, not a cover-photo avatar. */
export function ProfileIdentity({
  name,
  ringName,
  email,
  avatarUrl,
  tier,
  tape,
  className,
}: {
  name: string | null;
  ringName: string | null;
  email: string | null;
  avatarUrl: string | null;
  tier: Tier | null | undefined;
  tape: TapeFigure[];
  className?: string;
}) {
  const shown = (name ?? ringName ?? email?.split("@")[0] ?? "Unnamed lifter").trim();
  const [first, ...rest] = shown.split(/\s+/);
  const initial = shown.charAt(0).toUpperCase() || "?";
  const measured = tape.some((f) => f.value !== null);

  return (
    <header
      className={cn(
        "hb-plate relative isolate overflow-hidden rounded-[1.75rem] bg-bg [--hb-fade:var(--color-bg)] lg:rounded-[2rem]",
        className,
      )}
    >
      <div className="hb-hero-art absolute inset-y-0 right-0 -z-10 w-[82%] sm:w-[64%] lg:w-[54%]">
        <FighterArt
          fighterKey={tier?.key ?? "ohma"}
          variant="hero"
          priority
          fade="bottom"
          className="absolute inset-0"
          imageClassName={tier ? undefined : "opacity-50 grayscale"}
        />
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: "radial-gradient(60% 55% at 70% 16%, rgb(var(--accent-rgb) / 0.22), transparent 70%)",
          }}
        />
        {/* The portrait gives way to the black where the name and the tape
            sit: from the left, and up from the foot. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #000 0%, rgb(0 0 0 / 0.78) 22%, transparent 62%), linear-gradient(to top, #000 4%, rgb(0 0 0 / 0.6) 30%, transparent 58%)",
          }}
        />
      </div>

      <div className="flex min-h-[25rem] flex-col px-5 pb-5 pt-5 sm:min-h-[23rem] sm:px-7 sm:pb-6 lg:min-h-[27rem] lg:px-10 lg:pb-9 lg:pt-9">
        <p className="hb-hero-rise flex min-w-0 items-center gap-2 text-[13px] font-medium text-text/80">
          {tier ? (
            <>
              <span className="tnum shrink-0 rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-black">
                Rank {tier.rank} of {MAX_RANK}
              </span>
              <span className="truncate">{tier.name}</span>
            </>
          ) : (
            "No rank yet"
          )}
        </p>

        <div className="mt-auto pt-16">
          <h1
            className="hb-hero-rise font-display text-[clamp(2.75rem,15vw,4.25rem)] leading-[0.88] text-text [overflow-wrap:anywhere] lg:text-[6.5rem]"
            style={{ animationDelay: "60ms" }}
          >
            {first}
            {rest.length > 0 && (
              <>
                <br />
                {rest.join(" ")}
              </>
            )}
          </h1>
          <p
            className="hb-hero-rise mt-3 flex min-w-0 items-center gap-2 text-[15px] text-text/70"
            style={{ animationDelay: "120ms" }}
          >
            {avatarUrl && (
              <ProfileAvatar src={avatarUrl} initial={initial} className="size-6 shrink-0 text-[11px] ring-1 ring-text/20" />
            )}
            <span className="truncate">{ringName ? `@${ringName}` : email}</span>
          </p>
        </div>

        {/* The tale of the tape. Missing figures are a prompt, not dashes. */}
        {measured ? (
          <dl className="hb-hero-rise mt-6 grid grid-cols-3 divide-x divide-text/[0.14] border-t border-text/[0.18] pt-4 sm:max-w-md lg:mt-8 lg:max-w-lg lg:pt-5" style={{ animationDelay: "180ms" }}>
            {tape.map((f) => (
              <div key={f.label} className="min-w-0 px-3 first:pl-0 lg:px-5 lg:first:pl-0">
                <dt className="text-[12px] text-text/60 lg:text-[13px]">{f.label}</dt>
                <dd className="mt-1.5 whitespace-nowrap leading-none">
                  {f.value === null ? (
                    <a href="#about-you" className="text-[13px] text-text/60 underline decoration-text/25 underline-offset-4">
                      Add
                    </a>
                  ) : (
                    <>
                      <span className="font-display text-[1.375rem] text-text min-[400px]:text-[1.5rem] lg:text-[2rem]">
                        {f.value}
                      </span>
                      {f.unit && <span className="ml-1 text-[12px] text-text/60 lg:text-[13px]">{f.unit}</span>}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <a
            href="#about-you"
            className="mt-6 block border-t border-text/[0.18] pt-4 text-[15px] text-text/70 sm:max-w-md"
          >
            Add your height, weight and age for the tale of the tape.
          </a>
        )}
      </div>
    </header>
  );
}

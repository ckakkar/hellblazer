import { ScrollFloat } from "@/components/reactbits/scroll-float";
import { ScrollStack, ScrollStackItem } from "@/components/reactbits/scroll-stack";
import { FighterArt } from "@/components/tier/fighter-art";

/**
 * What using Fatty is, as three rounds in the order a lifter meets them,
 * dealt as a deck: each card pins as it arrives and the one before settles
 * back under it (ScrollStack). Each shows the thing itself as the app draws
 * it (a lift on the bar, the judge's verdict, the standings), as an example,
 * beside a plain sentence about what it does.
 */

const SETS = [
  { n: 1, set: "70 kg × 12", last: "67.5 × 12" },
  { n: 2, set: "70 kg × 11", last: "67.5 × 11" },
  { n: 3, set: "70 kg × 11", last: "67.5 × 10" },
];

const STANDINGS = [
  { place: 1, name: "@devil_lance", moved: "418,260" },
  { place: 2, name: "@iron_ohma", moved: "392,905" },
  { place: 3, name: "@you", moved: "377,120", you: true },
  { place: 4, name: "@raian", moved: "351,480" },
];

function Round({
  n,
  title,
  line,
  children,
}: {
  n: number;
  title: string;
  line: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 rounded-[1.75rem] bg-surface p-5 sm:gap-8 sm:p-8 lg:min-h-[min(36rem,78svh)] lg:grid-cols-12 lg:items-center lg:gap-12 lg:rounded-[2rem] lg:p-14">
      <div className="lg:col-span-5">
        <div className="flex items-end gap-4 lg:block">
          <p aria-hidden className="lp-outline tnum font-display text-[3.25rem] leading-[0.8] lg:text-[7rem]">
            {n}
          </p>
          <h3 className="text-[26px] font-semibold leading-[1.05] tracking-[-0.03em] text-text lg:mt-5 lg:text-[44px]">{title}</h3>
        </div>
        <p className="mt-3 max-w-sm text-[15px] leading-[1.5] text-text/70 sm:text-[16px] lg:text-[18px]">{line}</p>
      </div>
      <div className="lg:col-span-7">{children}</div>
    </div>
  );
}

export function LandingRounds() {
  return (
    <section aria-label="Three rounds" className="px-3 pb-[12svh] pt-[6svh] sm:px-6 lg:px-10 xl:px-14">
      <div className="px-2 sm:px-2 lg:px-4">
                <ScrollFloat
          as="h2"
          text="Three rounds."
          className="font-display text-[clamp(3rem,15vw,4.5rem)] leading-[0.9] text-text lg:text-[clamp(5rem,7vw,8rem)]"
        />
      </div>

      <ScrollStack className="mt-10 lg:mt-16">
        <ScrollStackItem>
          <Round
            n={1}
            title="Log the work"
            line="Big targets for a sweaty thumb, last time's numbers beside today's, and a line only when the numbers earn one."
          >
            {/* The exercise on the bar, as the logger draws it. */}
            <div className="rounded-3xl bg-bg/70 p-4 sm:p-5 lg:p-7">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-text lg:text-[24px]">Lat Pulldown</p>
                <p className="tnum text-[13px] text-muted">3 of 4 sets</p>
              </div>
              <ol className="mt-4 divide-y divide-text/[0.08] border-y border-text/[0.14]">
                {SETS.map((s) => (
                  <li key={s.n} className="flex items-baseline gap-3 px-1 py-2.5 text-[15px] lg:py-3 lg:text-[16px]">
                    <span className="tnum w-5 shrink-0 text-muted">{s.n}</span>
                    <span className="tnum flex-1 text-text">{s.set}</span>
                    <span className="tnum shrink-0 text-[13px] text-muted">last {s.last}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 px-1 text-[15px] leading-5 text-accent-ink">11 reps at 70 kg on Lat Pulldown beats your best.</p>
            </div>
          </Round>
        </ScrollStackItem>

        <ScrollStackItem>
          <Round
            n={2}
            title="Face the judge"
            line="An AI reads what you've logged and places you on the ladder. You choose whether to take the verdict."
          >
            {/* The verdict: a fighter's name as a poster word, on a black plate. */}
            <figure className="hb-plate relative isolate overflow-hidden rounded-3xl bg-bg [--hb-fade:var(--color-bg)]">
              <FighterArt fighterKey="gaolang" variant="card" fade="corner" className="absolute inset-y-0 right-0 -z-10 w-[72%]" />
              <div className="relative p-5 pt-20 lg:p-9 lg:pt-40">
                <p className="font-display text-[clamp(2.4rem,11vw,3.5rem)] uppercase leading-none text-text [transform:skewX(-8deg)] lg:text-[4.5rem]">
                  Gaolang
                </p>
                <blockquote className="mt-4 max-w-sm border-l-2 border-accent pl-3 text-[15px] leading-[1.5] text-text/85">
                  Three months of steady pressing and a pull that keeps climbing. You fight at the Thai God of War&apos;s pace now.
                </blockquote>
                <figcaption className="tnum mt-4 text-[13px] text-muted">Rank 4 of 10</figcaption>
              </div>
            </figure>
          </Round>
        </ScrollStackItem>

        <ScrollStackItem>
          <Round
            n={3}
            title="Take the hill"
            line="Pick a ring name and King of the Hill ranks you against every lifter by the weight you've moved."
          >
            <ol className="divide-y divide-text/[0.08] border-y-2 border-text/70">
              {STANDINGS.map((s) => (
                <li key={s.place} className="flex items-baseline gap-4 px-1 py-3 text-[16px] lg:py-4 lg:text-[18px]">
                  <span className="tnum font-display w-6 shrink-0 text-[20px] text-muted lg:text-[24px]">{s.place}</span>
                  <span className={s.you ? "flex-1 truncate font-semibold text-text" : "flex-1 truncate text-text/85"}>
                    {s.name}
                  </span>
                  <span className="tnum shrink-0 text-muted">
                    {s.moved} <span className="text-[13px]">kg</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 px-1 text-[14px] text-muted">King of the Hill, all time. Your name, not your email.</p>
          </Round>
        </ScrollStackItem>
      </ScrollStack>
    </section>
  );
}

/**
 * What using Fatty is, in the app's own type rather than a feature list:
 * three rounds, in the order a lifter meets them. Each shows the thing
 * itself as the app draws it (a workout's lines, the judge's verdict, the
 * standings), as an example, under a plain sentence about what it does.
 */

const LOGGED = [
  { lift: "Incline Dumbbell Press", sets: "32 kg × 10, 10, 9" },
  { lift: "Lat Pulldown", sets: "70 kg × 12, 11, 11" },
  { lift: "Rope Pushdown", sets: "27.5 kg × 15, 14" },
];

const STANDINGS = [
  { place: 1, name: "@devil_lance", moved: "418,260" },
  { place: 2, name: "@iron_ohma", moved: "392,905" },
  { place: 3, name: "@you", moved: "377,120", you: true },
];

function Round({ n, title, line, children }: { n: number; title: string; line: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col border-t-2 border-text/80 pt-4">
      <p className="tnum text-[13px] text-muted">Round {n}</p>
      <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-text lg:text-[26px]">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-[1.5] text-text/70">{line}</p>
      <div className="mt-6 lg:mt-auto lg:pt-8">{children}</div>
    </li>
  );
}

export function LandingRounds() {
  return (
    <section aria-labelledby="rounds-title" className="px-5 py-14 sm:px-8 lg:px-14 lg:py-24 xl:px-20">
      <h2 id="rounds-title" className="hb-display-lg text-[22px] font-semibold tracking-[-0.02em] text-text lg:text-[2.5rem]">
        Three rounds
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-12 lg:mt-12 lg:grid-cols-3 lg:gap-10">
        <Round
          n={1}
          title="Log the work"
          line="Big targets for a sweaty thumb, last time's numbers beside today's, and a line only when the numbers earn one."
        >
          <div className="divide-y divide-text/[0.08] border-y border-text/[0.14]">
            {LOGGED.map((r) => (
              <p key={r.lift} className="flex items-baseline justify-between gap-3 px-1 py-2.5 text-[14px]">
                <span className="truncate text-text">{r.lift}</span>
                <span className="tnum shrink-0 text-muted">{r.sets}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 px-1 text-[14px] leading-5 text-accent-ink">11 reps at 70 kg on Lat Pulldown beats your best.</p>
        </Round>

        <Round
          n={2}
          title="Face the judge"
          line="An AI reads what you've logged and places you on the ladder. You choose whether to take the verdict."
        >
          <figure className="hb-plate rounded-2xl bg-bg p-5 [--hb-fade:var(--color-bg)]">
            <p className="font-display text-[1.75rem] uppercase leading-none text-text [transform:skewX(-8deg)]">
              Gaolang
            </p>
            <blockquote className="mt-3 border-l-2 border-accent pl-3 text-[14px] leading-[1.5] text-text/80">
              Three months of steady pressing and a pull that keeps climbing. You fight at the Thai God of War&apos;s pace now.
            </blockquote>
            <figcaption className="tnum mt-3 text-[12px] text-muted">Rank 4 of 10</figcaption>
          </figure>
        </Round>

        <Round
          n={3}
          title="Take the hill"
          line="Pick a ring name and King of the Hill ranks you against every lifter by the weight you've moved."
        >
          <ol className="divide-y divide-text/[0.08] border-y border-text/[0.14]">
            {STANDINGS.map((s) => (
              <li key={s.place} className="flex items-baseline gap-3 px-1 py-2.5 text-[14px]">
                <span className="tnum w-4 shrink-0 text-muted">{s.place}</span>
                <span className={s.you ? "flex-1 truncate font-semibold text-text" : "flex-1 truncate text-text"}>
                  {s.name}
                </span>
                <span className="tnum shrink-0 text-muted">
                  {s.moved} <span className="text-[12px]">kg</span>
                </span>
              </li>
            ))}
          </ol>
        </Round>
      </ol>
    </section>
  );
}

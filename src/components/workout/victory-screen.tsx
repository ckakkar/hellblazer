import { FighterArt } from "@/components/tier/fighter-art";
import { Portal } from "@/components/ui/portal";
import type { TierKey } from "@/lib/tiers";

/**
 * The bell after the last set. Your fighter fills the screen, the result word
 * slams in with one flash of the accent, and the session's numbers follow it
 * up. It covers the hand-off to the session page, so it plays once and holds
 * its last frame until that page arrives. All CSS (`.hb-victory-*`); reduced
 * motion shows the final frame.
 */
export function VictoryScreen({
  word,
  stats,
  records,
  fighter,
}: {
  word: string;
  stats: { label: string; value: string; unit?: string }[];
  /** Personal records broken this session. */
  records: number;
  fighter: TierKey;
}) {
  return (
    <Portal>
      <div
        role="status"
        aria-live="assertive"
        className="fixed inset-0 z-[60] flex flex-col justify-end overflow-hidden bg-bg"
      >
        <div className="hb-victory-art absolute inset-0 [--hb-fade:var(--color-bg)]">
          <FighterArt
            fighterKey={fighter}
            variant="hero"
            fade="bottom"
            className="absolute inset-0"
            imageClassName="object-[60%_10%] opacity-80"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--color-bg) 22%, rgb(0 0 0 / 0.6) 50%, transparent 78%), radial-gradient(80% 50% at 50% 30%, rgb(var(--accent-rgb) / 0.2), transparent 70%)",
            }}
          />
        </div>
        {/* One flash of the accent as the word lands */}
        <div aria-hidden className="hb-victory-flash pointer-events-none absolute inset-0 bg-accent" />

        <div className="relative px-6 pb-[calc(env(safe-area-inset-bottom)+3.5rem)] sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="relative">
            <span aria-hidden className="hb-victory-slash absolute -bottom-3 -left-6 right-0 h-[3px] bg-accent" />
            <p className="hb-victory-word font-display relative text-[clamp(2.75rem,12.5vw,5rem)] leading-[0.92] text-text">
              {word}
            </p>
          </div>
          {records > 0 && (
            <p className="hb-victory-rise mt-4 text-[15px] font-medium text-accent" style={{ animationDelay: "420ms" }}>
              {records === 1 ? "1 record broken" : `${records} records broken`}
            </p>
          )}
          <dl className="mt-7 grid grid-cols-3 gap-4">
            {stats.map((s, i) => (
              <div key={s.label} className="hb-victory-rise min-w-0" style={{ animationDelay: `${480 + i * 90}ms` }}>
                <dt className="text-[13px] text-text/60">{s.label}</dt>
                <dd className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                  <span className="font-display text-[clamp(1.25rem,6vw,1.75rem)] leading-none text-text">{s.value}</span>
                  {s.unit && <span className="text-[13px] text-text/60">{s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Portal>
  );
}

"use client";

import { useState } from "react";
import { FighterArt } from "@/components/tier/fighter-art";
import { Sheet } from "@/components/ui/sheet";
import { FIGHTER_DOSSIERS } from "@/lib/fighter-dossiers";
import { TIERS, type TierKey } from "@/lib/tiers";

const BILL = [...TIERS].sort((a, b) => b.rank - a.rank);

/**
 * The ladder as a row of portraits you swipe through, strongest first. Tapping
 * a fighter opens their dossier in a sheet.
 */
export function LandingFighterRoster() {
  const [openKey, setOpenKey] = useState<TierKey | null>(null);
  const open = openKey ? BILL.find((t) => t.key === openKey) ?? null : null;
  const dossier = open ? FIGHTER_DOSSIERS[open.key] : null;

  return (
    <section aria-labelledby="ladder-title" className="py-10">
      <div className="mb-4 flex items-baseline justify-between gap-3 px-5 sm:px-8 lg:px-14 xl:px-20">
        <h2 id="ladder-title" className="text-[22px] font-semibold tracking-[-0.02em] text-text">
          The ladder
        </h2>
        <span className="text-[13px] text-muted">Ten fighters, weakest at the bottom</span>
      </div>
      <ol className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:scroll-px-14 lg:px-14 xl:px-20">
        {BILL.map((t) => (
          <li key={t.key} className="w-[42%] shrink-0 snap-start sm:w-[30%] lg:w-[17%]">
            <button
              type="button"
              onClick={() => setOpenKey(t.key)}
              className="group block w-full text-left"
              style={{ ["--hb-fade" as string]: "var(--color-surface)" }}
            >
              <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
                <FighterArt
                  fighterKey={t.key}
                  variant="card"
                  fade="bottom"
                  className="absolute inset-0"
                  imageClassName="object-[center_20%] transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="font-display absolute left-3 top-2.5 text-[15px] text-text/80">
                  {t.rank}
                </span>
              </span>
              <span className="mt-2 block truncate px-0.5 text-[15px] font-medium text-text">{t.name}</span>
              <span className="block truncate px-0.5 text-[13px] text-muted">{t.epithet}</span>
            </button>
          </li>
        ))}
      </ol>

      <Sheet open={open !== null} onClose={() => setOpenKey(null)} title={open?.name ?? ""}>
        {open && dossier && (
          <div className="px-5 pb-6">
            <p className="text-[15px] text-muted">
              {open.epithet}, rank {open.rank} of {TIERS.length}
            </p>
            <p className="mt-4 text-[16px] leading-[1.5] text-text">{dossier.profile}</p>
            <dl className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.05]">
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[15px] text-muted">Style</dt>
                <dd className="text-right text-[15px] text-text">{dossier.discipline}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[15px] text-muted">Signature</dt>
                <dd className="text-right text-[15px] text-text">{dossier.signature}</dd>
              </div>
            </dl>
            <h3 className="mt-6 text-[13px] font-medium text-muted">Training note</h3>
            <p className="mt-1.5 text-[15px] leading-[1.5] text-text">{dossier.cornerOrder}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

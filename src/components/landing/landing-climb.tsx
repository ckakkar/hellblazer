"use client";

import { useState, type CSSProperties } from "react";
import { FighterArt } from "@/components/tier/fighter-art";
import { Sheet } from "@/components/ui/sheet";
import { FIGHTER_DOSSIERS } from "@/lib/fighter-dossiers";
import { TIERS, type TierKey } from "@/lib/tiers";
import "./landing-climb.css";

const RISING = [...TIERS].sort((a, b) => a.rank - b.rank);
const PORTRAIT_SIZES = "(max-width: 744px) 320px, 640px";

/** One native timeline; the only React state is the fighter file you open. */
export function LandingClimb() {
  const [openKey, setOpenKey] = useState<TierKey | null>(null);
  const open = RISING.find((fighter) => fighter.key === openKey);
  const dossier = open ? FIGHTER_DOSSIERS[open.key] : null;

  return (
    <section className="climb hb-plate" aria-labelledby="climb-title">
      <div className="climb-stage">
        <div className="climb-heading">
          <h2 id="climb-title">The climb</h2>
          <span>Ten fighters, bottom rung first.</span>
        </div>
        <div className="climb-intro">
          <span className="climb-intro-zero font-display" aria-hidden="true">0</span>
          <p className="font-display">Everyone<br />starts<br />unranked.</p>
          <span className="climb-intro-note">Your first workout is the first rung.</span>
        </div>
        <div className="climb-scenes">
          {RISING.map((fighter) => (
            <div key={fighter.key} className={`climb-scene${fighter.rank === 10 ? " climb-summit" : ""}`} style={{ "--r": fighter.rank } as CSSProperties}>
              <span className="climb-number-window" aria-hidden="true">
                <span className="climb-number font-display"><span>{fighter.rank - 1}</span><span>{fighter.rank}</span></span>
              </span>
              <FighterArt fighterKey={fighter.key} variant="hero" fade="bottom" sizes={PORTRAIT_SIZES} className="climb-portrait" />
              <div className="climb-copy">
                <p className="climb-rank" aria-hidden="true">Rank {fighter.rank} of {RISING.length}</p>
                <h3 className="font-display" aria-hidden="true">{fighter.name}</h3>
                <p className="climb-epithet" aria-hidden="true">{fighter.epithet}</p>
                <button type="button" className="climb-file" onClick={() => setOpenKey(fighter.key)} aria-label={`Read ${fighter.name}'s fighter file`}>Read the fighter file <span aria-hidden="true">↗</span></button>
              </div>
            </div>
          ))}
        </div>
        <div className="climb-rail" aria-hidden="true"><span /></div>
        <div className="climb-floor" aria-hidden="true">
          <div className="climb-staircase">
            {RISING.map((fighter) => <div key={fighter.key} className={`climb-step${fighter.rank === 10 ? " climb-step-summit" : ""}`} style={{ "--r": fighter.rank } as CSSProperties}><span className="climb-step-rise"><span className="climb-step-light" /><span className="climb-step-number">{fighter.rank}</span></span></div>)}
          </div>
          <p className="climb-floor-note">The judge moves you up.</p>
        </div>
      </div>

      {/* Also the no-motion/no-timeline staircase. In the pinned experience,
          keyboard focus reveals this complete, navigable fighter directory. */}
      <div className="climb-directory">
        <p className="climb-directory-title">The ladder. Choose a fighter.</p>
        <ol className="climb-roster">
          {RISING.map((fighter) => (
            <li key={fighter.key} style={{ "--r": fighter.rank } as CSSProperties}>
              <button type="button" className="climb-roster-button" onClick={() => setOpenKey(fighter.key)} aria-label={`Rank ${fighter.rank}, ${fighter.name}, ${fighter.epithet}. Read their file`}>
                <span className="climb-roster-art"><FighterArt fighterKey={fighter.key} variant="hero" fade="bottom" sizes={PORTRAIT_SIZES} className="absolute inset-0" /></span>
                <span className="climb-roster-name font-display">{fighter.name}</span>
                <span className="climb-roster-epithet">{fighter.epithet}</span>
                <span className={`climb-roster-step${fighter.rank === 10 ? " climb-roster-summit" : ""}`}><span className="font-display">{fighter.rank}</span></span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="climb-fallback-note">The judge moves you up.</p>
      <Sheet open={open !== undefined} onClose={() => setOpenKey(null)} title={open?.name ?? ""}>
        {open && dossier && (
          <div className="px-5 pb-6">
            <p className="text-[15px] text-muted">{open.epithet}, rank {open.rank} of {RISING.length}</p>
            <p className="mt-4 text-[16px] leading-[1.5] text-text">{dossier.profile}</p>
            <dl className="mt-5 divide-y divide-text/[0.06] overflow-hidden rounded-2xl bg-text/[0.05]">
              <div className="flex items-baseline justify-between gap-4 px-4 py-3"><dt className="text-[15px] text-muted">Style</dt><dd className="text-right text-[15px] text-text">{dossier.discipline}</dd></div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3"><dt className="text-[15px] text-muted">Signature</dt><dd className="text-right text-[15px] text-text">{dossier.signature}</dd></div>
            </dl>
            <h3 className="mt-6 text-[13px] font-medium text-muted">Training note</h3>
            <p className="mt-1.5 text-[15px] leading-[1.5] text-text">{dossier.cornerOrder}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

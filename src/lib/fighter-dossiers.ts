import type { TierKey } from "@/lib/tiers";

export type FighterDossier = {
  discipline: string;
  signature: string;
  profile: string;
  cornerOrder: string;
};

/** Compact, training-focused notes for the public fight-card roster. */
export const FIGHTER_DOSSIERS: Record<TierKey, FighterDossier> = {
  rei: {
    discipline: "Raishin Style",
    signature: "Lightning Flash",
    profile:
      "A speed specialist shaped by an assassination art: direct lines, exact timing, and no wasted motion.",
    cornerOrder:
      "Move with intent. Make every warm-up rep look like the working set, then attack the weight before doubt catches up.",
  },
  setsuna: {
    discipline: "Koei Style",
    signature: "Rakshasa's Palm",
    profile:
      "Unorthodox footwork and rotational force make Kiryu dangerous from angles that should not exist.",
    cornerOrder:
      "Stop waiting for perfect conditions. Build control in awkward positions and turn obsession into repeatable practice.",
  },
  hatsumi: {
    discipline: "Hatsumi-Style Aikido",
    signature: "Stardrop",
    profile:
      "A deceptive counter fighter who stays loose, redirects pressure, and peaks when the stakes become real.",
    cornerOrder:
      "Do not confuse tension with effort. Own the setup, stay loose under load, and spend force only where it moves the bar.",
  },
  gaolang: {
    discipline: "Boxing + Muay Thai",
    signature: "Flash",
    profile:
      "World-class boxing layered over Muay Thai fundamentals: disciplined rhythm, sharp combinations, ruthless accuracy.",
    cornerOrder:
      "Fundamentals are not beneath you. Repeat the clean rep until precision becomes the thing fatigue cannot steal.",
  },
  julius: {
    discipline: "Strength Science",
    signature: "Muscle Control",
    profile:
      "Julius rejects mysticism in favor of engineered mass, total-body force, and brutally measurable output.",
    cornerOrder:
      "There is no hidden technique that replaces the work. Add the set, recover on purpose, and become harder to move.",
  },
  raian: {
    discipline: "Kure Clan Combat",
    signature: "Removal",
    profile:
      "Explosive genetics backed by a complete combat system, with aggression that can overwhelm a fight in seconds.",
    cornerOrder:
      "Intensity is a weapon, not a mood. Earn the right to unleash it by making your technique hold when the set turns ugly.",
  },
  wakatsuki: {
    discipline: "Rokushin Kaikan Karate",
    signature: "Blast Core",
    profile:
      "Superman Syndrome gives the Wild Tiger extraordinary density, but patience and experience make that power land.",
    cornerOrder:
      "Respect heavy weight without fearing it. Brace, commit, and let years of honest repetitions speak in one decisive rep.",
  },
  ohma: {
    discipline: "Niko Style",
    signature: "Demonsbane",
    profile:
      "A complete four-kata system lets Ohma redirect, endure, control, and strike while adapting in the middle of battle.",
    cornerOrder:
      "Adapt between rounds, not during the excuse. Read the last set, change what failed, and walk back in with an answer.",
  },
  agito: {
    discipline: "Formless + Martial Arts",
    signature: "Evolution",
    profile:
      "The Fang switches between fluid improvisation and compressed fundamentals, evolving specifically for the opponent.",
    cornerOrder:
      "Your weak point is today's opponent. Train it directly until the thing that exposed you becomes part of your arsenal.",
  },
  kuroki: {
    discipline: "Kaiwan Style",
    signature: "Devil Lance",
    profile:
      "Conditioning, timing, and decades of refinement make Kuroki the standard even prodigies cannot rush past.",
    cornerOrder:
      "Mastery looks repetitive from the outside. Show up, make the ordinary rep exact, and let time turn discipline into force.",
  },
};

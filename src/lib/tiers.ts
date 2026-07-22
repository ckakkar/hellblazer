export type Tier = {
  key: string;
  name: string;
  rank: number;
  blurb: string;
};

/** The strength ladder, weakest → strongest. Rank 1..9. */
export const TIERS: Tier[] = [
  {
    key: "doppo",
    name: "Doppo Orochi",
    rank: 1,
    blurb: "The undefeated karate master. Grit over genetics.",
  },
  {
    key: "retsu",
    name: "Retsu Kaioh",
    rank: 2,
    blurb: "4000 years of kung-fu. Refined, disciplined power.",
  },
  {
    key: "oliva",
    name: "Biscuit Oliva",
    rank: 3,
    blurb: "Mr. Unchained. Grotesque, unnatural muscle.",
  },
  {
    key: "hanayama",
    name: "Kaoru Hanayama",
    rank: 4,
    blurb: "A monster's grip. Raw, honorable brute force.",
  },
  {
    key: "musashi",
    name: "Musashi Miyamoto",
    rank: 5,
    blurb: "The reborn swordsman. Lethal precision.",
  },
  {
    key: "jack",
    name: "Jack Hanma",
    rank: 6,
    blurb: "Effort incarnate. Grew through sheer will.",
  },
  {
    key: "pickle",
    name: "Pickle",
    rank: 7,
    blurb: "Prehistoric predator. Untrained perfection.",
  },
  {
    key: "baki",
    name: "Baki Hanma",
    rank: 8,
    blurb: "The protagonist. Forever chasing the strongest.",
  },
  {
    key: "yujiro",
    name: "Yujiro Hanma",
    rank: 9,
    blurb: "The Ogre. The strongest creature alive.",
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key);
export const MAX_RANK = TIERS.length;

export function getTier(key: string | null | undefined): Tier | null {
  if (!key) return null;
  return TIERS.find((t) => t.key === key) ?? null;
}

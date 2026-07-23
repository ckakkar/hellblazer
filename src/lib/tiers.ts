export type Tier = {
  key: string;
  name: string;
  rank: number;
  blurb: string;
};

/** The strength ladder, weakest → strongest. Rank 1..9. Kengan Ashura fighters. */
export const TIERS: Tier[] = [
  {
    key: "rei",
    name: "Rei Mikazuchi",
    rank: 1,
    blurb: "Assassin's precision. One strike, one kill.",
  },
  {
    key: "setsuna",
    name: "Setsuna Kiryu",
    rank: 2,
    blurb: "Devotion turned lethal — the god-chaser's blades.",
  },
  {
    key: "hatsumi",
    name: "Sen Hatsumi",
    rank: 3,
    blurb: "Effortless aikido. Turns your own force against you.",
  },
  {
    key: "gaolang",
    name: "Gaolang Wongsawat",
    rank: 4,
    blurb: "The Thai god of war. Eight limbs, no mercy.",
  },
  {
    key: "julius",
    name: "Julius Reinhold",
    rank: 5,
    blurb: "Grotesque, engineered muscle. Raw power made flesh.",
  },
  {
    key: "raian",
    name: "Raian Kure",
    rank: 6,
    blurb: "The Kure clan's beast. Removal off the leash.",
  },
  {
    key: "wakatsuki",
    name: "Wakatsuki Takeshi",
    rank: 7,
    blurb: "The Wild Tiger. Superhuman power, raw and untamed.",
  },
  {
    key: "ohma",
    name: "Ohma Tokita",
    rank: 8,
    blurb: "The Ashura. Niko Style, evolving mid-fight.",
  },
  {
    key: "agito",
    name: "Kanoh Agito",
    rank: 9,
    blurb: "The Fang of Metsudo. Undefeated, adapts to anything.",
  },
  {
    key: "kuroki",
    name: "Kuroki Gensai",
    rank: 10,
    blurb: "The Devil Lance. The apex the strongest still fear.",
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key);
export const MAX_RANK = TIERS.length;

export function getTier(key: string | null | undefined): Tier | null {
  if (!key) return null;
  return TIERS.find((t) => t.key === key) ?? null;
}

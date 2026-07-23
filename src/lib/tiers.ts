export type Tier = {
  key: string;
  name: string;
  epithet: string;
  rank: number;
  blurb: string;
};

/** The strength ladder, weakest → strongest. Rank 1..10. Kengan Ashura fighters
 *  with their canon call signs. */
export const TIERS: Tier[] = [
  {
    key: "rei",
    name: "Rei Mikazuchi",
    epithet: "The Lightning God",
    rank: 1,
    blurb: "Assassin's precision. One strike, one kill.",
  },
  {
    key: "setsuna",
    name: "Setsuna Kiryu",
    epithet: "The Beautiful Beast",
    rank: 2,
    blurb: "Devotion turned lethal — the god-chaser's blades.",
  },
  {
    key: "hatsumi",
    name: "Sen Hatsumi",
    epithet: "The Floating Cloud",
    rank: 3,
    blurb: "Effortless aikido. Turns your own force against you.",
  },
  {
    key: "gaolang",
    name: "Gaolang Wongsawat",
    epithet: "The Thai God of War",
    rank: 4,
    blurb: "Eight limbs, no mercy. Muay Thai perfected.",
  },
  {
    key: "julius",
    name: "Julius Reinhold",
    epithet: "The Monster",
    rank: 5,
    blurb: "Grotesque, engineered muscle. Raw power made flesh.",
  },
  {
    key: "raian",
    name: "Raian Kure",
    epithet: "The Devil",
    rank: 6,
    blurb: "The Kure clan's beast. Removal off the leash.",
  },
  {
    key: "wakatsuki",
    name: "Wakatsuki Takeshi",
    epithet: "The Wild Tiger",
    rank: 7,
    blurb: "Superhuman power, raw and untamed.",
  },
  {
    key: "ohma",
    name: "Ohma Tokita",
    epithet: "The Ashura",
    rank: 8,
    blurb: "Niko Style, evolving mid-fight.",
  },
  {
    key: "agito",
    name: "Kanoh Agito",
    epithet: "The Fang of Metsudo",
    rank: 9,
    blurb: "Undefeated, adapts to anything.",
  },
  {
    key: "kuroki",
    name: "Kuroki Gensai",
    epithet: "The Devil Lance",
    rank: 10,
    blurb: "The apex the strongest still fear.",
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key);
export const MAX_RANK = TIERS.length;

export function getTier(key: string | null | undefined): Tier | null {
  if (!key) return null;
  return TIERS.find((t) => t.key === key) ?? null;
}

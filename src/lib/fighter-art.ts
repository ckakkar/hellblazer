import type { StaticImageData } from "next/image";
import agito from "../../public/art/fighters/agito.webp";
import gaolang from "../../public/art/fighters/gaolang.webp";
import hatsumi from "../../public/art/fighters/hatsumi.webp";
import julius from "../../public/art/fighters/julius.webp";
import kuroki from "../../public/art/fighters/kuroki.webp";
import ohma from "../../public/art/fighters/ohma.webp";
import raian from "../../public/art/fighters/raian.webp";
import rei from "../../public/art/fighters/rei.webp";
import setsuna from "../../public/art/fighters/setsuna.webp";
import wakatsuki from "../../public/art/fighters/wakatsuki.webp";
import type { TierKey } from "@/lib/tiers";

export type FighterArtEntry = {
  src: StaticImageData;
  source: string;
  /** Where the face is, as percentages of the portrait. Every crop centres
   *  on it (object-position), and a thumbnail zooms in on it, so a fighter
   *  is recognisable at 40px, not a torso. Measured by eye on a 10% grid. */
  face: { x: number; y: number };
};

/**
 * One typed source of truth for fighter artwork. Static imports give Next the
 * intrinsic dimensions and blur data at build time; a missing tier key now
 * fails compilation instead of becoming a broken runtime URL.
 */
export const FIGHTER_ART: Record<TierKey, FighterArtEntry> = {
  rei: { src: rei, source: "mikazuchi01.jpg", face: { x: 50, y: 21 } },
  setsuna: { src: setsuna, source: "kiryu01.jpg", face: { x: 44, y: 21 } },
  hatsumi: { src: hatsumi, source: "hatsumi01.jpg", face: { x: 54, y: 20 } },
  gaolang: { src: gaolang, source: "kaolan01.jpg", face: { x: 26, y: 23 } },
  julius: { src: julius, source: "julius01.jpg", face: { x: 63, y: 14 } },
  raian: { src: raian, source: "raian01.jpg", face: { x: 40, y: 23 } },
  wakatsuki: { src: wakatsuki, source: "wakatsuki01.jpg", face: { x: 44, y: 20 } },
  ohma: { src: ohma, source: "tokita01.jpg", face: { x: 44, y: 23 } },
  agito: { src: agito, source: "agito01.jpg", face: { x: 41, y: 20 } },
  kuroki: { src: kuroki, source: "kuroki01.jpg", face: { x: 38, y: 20 } },
};

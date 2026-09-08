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
};

/**
 * One typed source of truth for fighter artwork. Static imports give Next the
 * intrinsic dimensions and blur data at build time; a missing tier key now
 * fails compilation instead of becoming a broken runtime URL.
 */
export const FIGHTER_ART: Record<TierKey, FighterArtEntry> = {
  rei: { src: rei, source: "mikazuchi01.jpg" },
  setsuna: { src: setsuna, source: "kiryu01.jpg" },
  hatsumi: { src: hatsumi, source: "hatsumi01.jpg" },
  gaolang: { src: gaolang, source: "kaolan01.jpg" },
  julius: { src: julius, source: "julius01.jpg" },
  raian: { src: raian, source: "raian01.jpg" },
  wakatsuki: { src: wakatsuki, source: "wakatsuki01.jpg" },
  ohma: { src: ohma, source: "tokita01.jpg" },
  agito: { src: agito, source: "agito01.jpg" },
  kuroki: { src: kuroki, source: "kuroki01.jpg" },
};

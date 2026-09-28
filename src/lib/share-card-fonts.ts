/** Fonts for the share cards (/api/share/*). */

/** One static TTF cut of Archivo from Google (the image renderer reads
 *  neither the app's woff2 nor variable fonts). A bare UA gets TTF; a browser
 *  UA would get woff2. Null on any failure so the card still renders. */
async function fetchFont(query: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export type CardFonts = { text: ArrayBuffer | null; display: ArrayBuffer | null };

// Fetched once per warm instance rather than on every card. A failed load
// isn't kept, so the next render retries.
let fonts: Promise<CardFonts> | null = null;
export function loadFonts(): Promise<CardFonts> {
  fonts ??= Promise.all([
    fetchFont("Archivo:wght@500"),
    fetchFont("Archivo:wdth,wght@125,700"),
  ]).then(([text, display]) => {
    if (!text || !display) fonts = null;
    return { text, display };
  });
  return fonts;
}


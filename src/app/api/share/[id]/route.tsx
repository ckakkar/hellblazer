import { ImageResponse } from "next/og";
import { format, parseISO } from "date-fns";
import { getSessionDetail } from "@/lib/data/sessions";
import { getProfile } from "@/lib/data/profile";
import { MAX_RANK, getTier } from "@/lib/tiers";
import { getUnit, getAccent } from "@/lib/settings";
import { ACCENTS } from "@/lib/accents";
import { kgToLb } from "@/lib/units";

export const dynamic = "force-dynamic";

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

type CardFonts = { text: ArrayBuffer | null; display: ArrayBuffer | null };

// Fetched once per warm instance rather than on every card. A failed load
// isn't kept, so the next render retries.
let fonts: Promise<CardFonts> | null = null;
function loadFonts(): Promise<CardFonts> {
  fonts ??= Promise.all([
    fetchFont("Archivo:wght@500"),
    fetchFont("Archivo:wdth,wght@125,700"),
  ]).then(([text, display]) => {
    if (!text || !display) fonts = null;
    return { text, display };
  });
  return fonts;
}

// The app's palette (globals.css): true black, graphite surface, bone text.
const BG = "#000000";
const SURFACE = "#121214";
const LINE = "rgba(255,255,255,0.07)";
const TEXT = "#f4f2ee";
const MUTED = "#8e8c88";
// lucide "flame", the app's mark
const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [session, profile, unit, accentKey, cardFonts] = await Promise.all([
    getSessionDetail(id),
    getProfile(),
    getUnit(),
    getAccent(),
    loadFonts(),
  ]);
  if (!session) return new Response("Not found", { status: 404 });

  const accent = ACCENTS.find((a) => a.key === accentKey)?.swatch ?? ACCENTS[0].swatch;
  const tier = getTier(profile?.tier);
  const display = cardFonts.display ? "Archivo Expanded" : undefined;

  // Aggregate working sets → volume, count, and the best set per exercise.
  let volumeKg = 0;
  let sets = 0;
  const perEx: { name: string; weight: number; reps: number; est: number }[] = [];
  for (const se of session.session_exercise) {
    let best: { weight: number; reps: number; est: number } | null = null;
    for (const s of se.set) {
      if (s.is_warmup) continue;
      const w = Number(s.weight_kg);
      const reps = Number(s.reps);
      volumeKg += w * reps;
      sets += 1;
      const est = w * (1 + reps / 30);
      if (!best || est > best.est) best = { weight: w, reps, est };
    }
    if (best) perEx.push({ name: se.exercise?.name ?? "Exercise", ...best });
  }
  perEx.sort((a, b) => b.est - a.est);
  const topLifts = perEx.slice(0, 5);

  const toDisp = (kg: number) => Math.round((unit === "lb" ? kgToLb(kg) : kg) * 2) / 2;
  const trim = (n: number) =>
    Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  const displayVolume = Math.round(unit === "lb" ? kgToLb(volumeKg) : volumeKg);
  const dateStr = session.date
    ? format(parseISO(session.date), "MMM d, yyyy")
    : "";
  const d = session.duration_min;
  const durationStr = d
    ? d >= 60
      ? `${Math.floor(d / 60)}h ${d % 60}m`
      : `${d}m`
    : "-";

  const tiles: [string, string][] = [
    ["Sets", String(sets)],
    ["Exercises", String(perEx.length)],
    ["Duration", durationStr],
  ];

  const options: ConstructorParameters<typeof ImageResponse>[1] = {
    width: 1080,
    height: 1350,
  };
  const loaded = [
    cardFonts.text && { name: "Archivo", data: cardFonts.text, weight: 500 as const, style: "normal" as const },
    cardFonts.display && { name: "Archivo Expanded", data: cardFonts.display, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));
  if (loaded.length > 0) options.fonts = loaded;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          color: TEXT,
          padding: 76,
          fontFamily: cardFonts.text ? "Archivo" : undefined,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d={FLAME} />
            </svg>
            <div style={{ fontSize: 32, color: TEXT }}>Fatty</div>
          </div>
          <div style={{ fontSize: 28, color: MUTED }}>
            {tier ? `Rank ${tier.rank} of ${MAX_RANK}` : "Unranked"}
          </div>
        </div>

        {/* title */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 88 }}>
          <div style={{ color: MUTED, fontSize: 30 }}>{dateStr}</div>
          <div
            style={{
              color: TEXT,
              fontSize: 80,
              lineHeight: 1.04,
              marginTop: 14,
              fontFamily: display,
              letterSpacing: -2,
            }}
          >
            {session.title ?? "Session"}
          </div>
        </div>

        {/* hero volume */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
          <div style={{ color: MUTED, fontSize: 30 }}>Volume</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 8 }}>
            <div style={{ color: TEXT, fontSize: 168, lineHeight: 0.9, fontFamily: display, letterSpacing: -6 }}>
              {displayVolume.toLocaleString()}
            </div>
            <div style={{ color: MUTED, fontSize: 44, marginBottom: 18 }}>{unit}</div>
          </div>
        </div>

        {/* stats */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            backgroundColor: SURFACE,
            borderRadius: 32,
            padding: "30px 0",
          }}
        >
          {tiles.map(([label, value], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "0 34px",
                borderLeft: i === 0 ? "none" : `2px solid ${LINE}`,
              }}
            >
              <div style={{ color: MUTED, fontSize: 26 }}>{label}</div>
              <div style={{ color: TEXT, fontSize: 56, lineHeight: 1, marginTop: 12, fontFamily: display, letterSpacing: -2 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* top lifts */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, flexGrow: 1 }}>
          <div style={{ color: MUTED, fontSize: 26, marginBottom: 4 }}>Top lifts</div>
          {topLifts.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: i === 0 ? "none" : `2px solid ${LINE}`,
                // Sized so five lifts still leave room for the rank footer.
                padding: "14px 0",
              }}
            >
              <div style={{ color: TEXT, fontSize: 34, flex: 1, minWidth: 0 }}>{l.name}</div>
              <div style={{ color: TEXT, fontSize: 32, flexShrink: 0, fontFamily: display }}>
                {`${trim(toDisp(l.weight))}${unit} × ${l.reps}`}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 28 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: tier ? accent : MUTED, fontSize: 34, fontFamily: display, letterSpacing: -1 }}>
              {tier ? tier.name : "Unranked"}
            </div>
            {tier ? <div style={{ color: MUTED, fontSize: 26, marginTop: 6 }}>{tier.epithet}</div> : null}
          </div>
          <div style={{ color: MUTED, fontSize: 26 }}>hellblazer.vercel.app</div>
        </div>
      </div>
    ),
    options,
  );
}

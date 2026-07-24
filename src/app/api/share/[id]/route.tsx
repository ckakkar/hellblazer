import { ImageResponse } from "next/og";
import { format, parseISO } from "date-fns";
import { getSessionDetail } from "@/lib/data/sessions";
import { getProfile } from "@/lib/data/profile";
import { getTier } from "@/lib/tiers";
import { getUnit, getAccent } from "@/lib/settings";
import { ACCENTS } from "@/lib/accents";
import { kgToLb } from "@/lib/units";

export const dynamic = "force-dynamic";

/** Pull the Anton (impact) face for the big numbers; null on any failure so the
 *  card still renders with the built-in default font. */
async function loadAnton(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Anton", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

const BG = "#0a0908";
const SURFACE = "#100f0e";
const BORDER = "#262220";
const TEXT = "#efece8";
const MUTED = "#86807a";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [session, profile, unit, accentKey, anton] = await Promise.all([
    getSessionDetail(id),
    getProfile(),
    getUnit(),
    getAccent(),
    loadAnton(),
  ]);
  if (!session) return new Response("Not found", { status: 404 });

  const accent = ACCENTS.find((a) => a.key === accentKey)?.swatch ?? ACCENTS[0].swatch;
  const tier = getTier(profile?.tier);
  const impact = anton ? "Anton" : undefined;

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
    : "—";

  const tiles: [string, string][] = [
    ["Sets", String(sets)],
    ["Exercises", String(perEx.length)],
    ["Duration", durationStr],
  ];

  const options: ConstructorParameters<typeof ImageResponse>[1] = {
    width: 1080,
    height: 1350,
  };
  if (anton) {
    options.fonts = [{ name: "Anton", data: anton, weight: 400, style: "normal" }];
  }

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
          padding: 72,
          position: "relative",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            height: 14,
            backgroundColor: accent,
          }}
        />
        {/* faint kanji watermark */}
        <div
          style={{
            position: "absolute",
            right: -60,
            bottom: -260,
            fontSize: 680,
            lineHeight: 1,
            color: "rgba(255,255,255,0.035)",
            fontFamily: impact,
            display: "flex",
          }}
        >
          力
        </div>

        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 66,
                height: 66,
                borderRadius: 16,
                backgroundColor: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: BG,
                fontSize: 30,
                fontWeight: 800,
                fontFamily: impact,
              }}
            >
              HB
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 7, color: TEXT }}>
              HELL BLAZER
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: `2px solid ${accent}`,
              borderRadius: 9999,
              padding: "12px 26px",
              color: accent,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            {tier ? `RANK ${String(tier.rank).padStart(2, "0")}` : "UNRANKED"}
          </div>
        </div>

        {/* title */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
          <div
            style={{
              color: MUTED,
              fontSize: 26,
              letterSpacing: 9,
              textTransform: "uppercase",
            }}
          >
            {dateStr}
          </div>
          <div
            style={{
              color: TEXT,
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1,
              marginTop: 16,
              fontFamily: impact,
              textTransform: "uppercase",
            }}
          >
            {session.title ?? "Session"}
          </div>
        </div>

        {/* hero volume */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 54 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <div
              style={{
                color: accent,
                fontSize: 172,
                lineHeight: 0.86,
                fontFamily: impact,
                fontWeight: 800,
              }}
            >
              {displayVolume.toLocaleString()}
            </div>
            <div
              style={{
                color: MUTED,
                fontSize: 42,
                fontWeight: 700,
                marginBottom: 26,
              }}
            >
              {unit}
            </div>
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 28,
              letterSpacing: 7,
              textTransform: "uppercase",
              marginTop: 6,
            }}
          >
            Total volume moved
          </div>
        </div>

        {/* stat tiles */}
        <div style={{ display: "flex", gap: 22, marginTop: 52 }}>
          {tiles.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                border: `2px solid ${BORDER}`,
                borderRadius: 22,
                padding: "30px 32px",
                backgroundColor: SURFACE,
              }}
            >
              <div
                style={{
                  color: TEXT,
                  fontSize: 66,
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: impact,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  color: MUTED,
                  fontSize: 24,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  marginTop: 12,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* top lifts */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 52,
            flexGrow: 1,
          }}
        >
          <div
            style={{
              color: MUTED,
              fontSize: 24,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Top lifts
          </div>
          {topLifts.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: `2px solid ${BORDER}`,
                padding: "22px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ color: "#524c45", fontSize: 26, fontWeight: 700, width: 34 }}>
                  {String(i + 1)}
                </div>
                <div style={{ color: TEXT, fontSize: 34, fontWeight: 600 }}>
                  {l.name}
                </div>
              </div>
              <div style={{ color: TEXT, fontSize: 34, fontWeight: 700, flexShrink: 0 }}>
                {`${trim(toDisp(l.weight))}${unit} × ${l.reps}`}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 30,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: accent,
                fontSize: 32,
                fontWeight: 800,
                fontFamily: impact,
                textTransform: "uppercase",
              }}
            >
              {tier ? tier.name : "Unranked fighter"}
            </div>
            {tier ? (
              <div
                style={{
                  color: MUTED,
                  fontSize: 22,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {tier.epithet}
              </div>
            ) : null}
          </div>
          <div style={{ color: MUTED, fontSize: 24, letterSpacing: 2 }}>
            hellblazer.vercel.app
          </div>
        </div>
      </div>
    ),
    options,
  );
}

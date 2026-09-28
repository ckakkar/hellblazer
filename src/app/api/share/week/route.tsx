import { ImageResponse } from "next/og";
import { addDays, format, getISOWeek, isMonday, isValid, parseISO, subWeeks } from "date-fns";
import { getAuthedContext } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";
import { MAX_RANK, getTier } from "@/lib/tiers";
import { getUnit } from "@/lib/settings";
import { kgToLb } from "@/lib/units";
import { loadFonts } from "@/lib/share-card-fonts";
import { gatherRecap } from "@/lib/weekly-recap";
import { weekStreak } from "@/lib/widget-moments";

export const dynamic = "force-dynamic";

// The widgets' fight card (ios/App/Widgets/WidgetStyle.swift): black, the
// flame's red glowing in from the corner, the fighter in red ink.
const BG = "#000000";
const SURFACE = "#121214";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#f4f2ee";
const MUTED = "#8e8c88";
const RED = "#df2d28";
const TRACK = "rgba(244,242,238,0.13)";
// lucide "flame", the app's mark
const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

/** The fighter in red ink (public/art/fighters/ink, InkArt's lines), as a data URI. */
async function inkArt(origin: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(new URL(`/art/fighters/ink/${key}.png`, origin));
    if (!res.ok) return null;
    return `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The week as a card to share: GET /api/share/week?week=yyyy-MM-dd (its
 * Monday). Workouts against the plan, sets and volume, the streak, the new
 * bests and the weak point to bring up, on the widgets' fight card with the
 * lifter's fighter sketched in red ink behind.
 */
export async function GET(request: Request) {
  const week = new URL(request.url).searchParams.get("week") ?? "";
  const monday = parseISO(week);
  if (!isValid(monday) || !isMonday(monday)) return new Response("A week's Monday is required", { status: 400 });

  let context: Awaited<ReturnType<typeof getAuthedContext>>;
  try {
    context = await getAuthedContext();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const { supabase, user } = context;
  const lastDay = format(addDays(monday, 6), "yyyy-MM-dd");
  const [facts, profile, unit, fonts, history] = await Promise.all([
    gatherRecap(supabase, user.id, week),
    getProfile(),
    getUnit(),
    loadFonts(),
    supabase
      .from("v_session_summary")
      .select("session_date")
      .eq("user_id", user.id)
      .not("finished_at", "is", null)
      .gte("session_date", format(subWeeks(monday, 52), "yyyy-MM-dd"))
      .lte("session_date", lastDay),
  ]);
  const dates = (history.data ?? []).map((r) => r.session_date).filter((d): d is string => Boolean(d));
  const streak = weekStreak(dates, lastDay, facts.planned);
  const tier = getTier(profile?.tier);
  const ink = tier ? await inkArt(new URL(request.url).origin, tier.key) : null;
  const display = fonts.display ? "Archivo Expanded" : undefined;

  const shown = (kg: number) => (unit === "lb" ? kgToLb(kg) : kg);
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  const volume = shown(facts.volumeKg);
  // As the app writes it: "6.5k" from a thousand up.
  const volumeText = volume >= 1000 ? `${trim(Math.round(volume / 100) / 10)}k` : String(Math.round(volume));
  const range =
    format(monday, "MMM") === format(addDays(monday, 6), "MMM")
      ? `${format(monday, "d")}–${format(addDays(monday, 6), "d MMM yyyy")}`
      : `${format(monday, "d MMM")} – ${format(addDays(monday, 6), "d MMM yyyy")}`;
  const planned = facts.planned;
  const segments = planned && planned <= 7 ? planned : null;

  const options: ConstructorParameters<typeof ImageResponse>[1] = { width: 1080, height: 1350 };
  const loaded = [
    fonts.text && { name: "Archivo", data: fonts.text, weight: 500 as const, style: "normal" as const },
    fonts.display && { name: "Archivo Expanded", data: fonts.display, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));
  if (loaded.length > 0) options.fonts = loaded;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          display: "flex",
          position: "relative",
          backgroundColor: BG,
          backgroundImage: `linear-gradient(225deg, rgba(223,45,40,0.42) 0%, rgba(223,45,40,0.1) 28%, rgba(0,0,0,0) 52%)`,
          color: TEXT,
          fontFamily: fonts.text ? "Archivo" : undefined,
        }}
      >
        {ink ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ink}
            width={864}
            height={1080}
            alt=""
            style={{ position: "absolute", right: -150, top: 150, opacity: 0.8 }}
          />
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 76 }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d={FLAME} />
              </svg>
              <div style={{ fontSize: 32 }}>Fatty</div>
            </div>
            <div style={{ fontSize: 28, color: MUTED }}>{range}</div>
          </div>

          {/* title */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
            <div style={{ color: RED, fontSize: 30 }}>Week in the ring</div>
            <div style={{ fontSize: 124, lineHeight: 1, marginTop: 10, fontFamily: display, letterSpacing: -5 }}>
              {`Week ${getISOWeek(monday)}`}
            </div>
          </div>

          {/* workouts against the plan */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 60, width: 560 }}>
            <div style={{ color: MUTED, fontSize: 28 }}>Workouts</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 6 }}>
              <div style={{ fontSize: 150, lineHeight: 0.9, fontFamily: display, letterSpacing: -6 }}>{String(facts.sessions)}</div>
              {planned ? <div style={{ color: MUTED, fontSize: 44, marginBottom: 14 }}>{`of ${planned}`}</div> : null}
            </div>
            {segments ? (
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                {Array.from({ length: segments }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: i < facts.sessions ? RED : TRACK,
                      boxShadow: i < facts.sessions ? "0 0 18px rgba(223,45,40,0.7)" : "none",
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* sets, volume, streak */}
          <div style={{ display: "flex", marginTop: 52, backgroundColor: SURFACE, borderRadius: 32, padding: "28px 0" }}>
            {[
              ["Sets", String(facts.sets)],
              ["Volume", `${volumeText} ${unit}`],
              ["Streak", streak === 1 ? "1 week" : `${streak} weeks`],
            ].map(([label, value], i) => (
              <div
                key={label}
                style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 30px", borderLeft: i === 0 ? "none" : `2px solid ${LINE}` }}
              >
                <div style={{ color: MUTED, fontSize: 26 }}>{label}</div>
                <div style={{ fontSize: 44, lineHeight: 1, marginTop: 12, fontFamily: display, letterSpacing: -2, whiteSpace: "nowrap" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* new bests */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, flexGrow: 1, width: 700 }}>
            <div style={{ color: MUTED, fontSize: 26, marginBottom: 4 }}>New bests</div>
            {facts.bests.length > 0 ? (
              facts.bests.slice(0, 3).map((b, i) => (
                <div
                  key={b.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: i === 0 ? "none" : `2px solid ${LINE}`,
                    padding: "12px 0",
                  }}
                >
                  <div style={{ fontSize: 34, flex: 1, minWidth: 0 }}>{b.name}</div>
                  <div style={{ fontSize: 32, color: RED, fontFamily: display }}>{`${trim(Math.round(shown(b.topKg) * 2) / 2)} ${unit}`}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 32, color: MUTED, padding: "12px 0" }}>{"None this week. Next week's for breaking one."}</div>
            )}
            <div style={{ fontSize: 28, color: MUTED, marginTop: 18 }}>
              {facts.weakest
                ? `${facts.weakest.label} got ${facts.weakest.sets} ${facts.weakest.sets === 1 ? "set" : "sets"}: bring it up next week.`
                : "Every weak point got its 10 sets."}
            </div>
          </div>

          {/* footer */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 24 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: tier ? RED : MUTED, fontSize: 34, fontFamily: display, letterSpacing: -1 }}>
                {tier ? tier.name : "Unranked"}
              </div>
              <div style={{ color: MUTED, fontSize: 26, marginTop: 6 }}>
                {tier ? `${tier.epithet}, rank ${tier.rank} of ${MAX_RANK}` : "Ask the judge for a rank"}
              </div>
            </div>
            <div style={{ color: MUTED, fontSize: 26 }}>hellblazer.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    options,
  );
}

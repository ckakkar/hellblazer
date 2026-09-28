import { NextResponse, type NextRequest } from "next/server";
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { createServiceClient } from "@/lib/supabase/service";
import { pushConfigured, sendPush } from "@/lib/push";
import { apnsConfigured, sendApns } from "@/lib/apns";
import { gatherRecap, recapMessage, recapWeek } from "@/lib/weekly-recap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sub = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string | null;
  created_at: string;
};

/** An iPhone running the app, reached through APNs. */
type Device = { user_id: string; token: string; timezone: string | null };

/** Local wall-clock hour (0-23) and date (yyyy-MM-dd) in a given IANA zone. */
function localParts(tz: string | null): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    hour: parseInt(parts.hour ?? "0", 10),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

type Svc = NonNullable<ReturnType<typeof createServiceClient>>;

/** Returns the reminder text if a workout is due today, else null. */
async function workoutDue(
  svc: Svc,
  userId: string,
  today: string,
): Promise<{ programName: string; nextName: string } | null> {
  const { data: program } = await svc
    .from("program")
    .select(
      "id, name, start_date, duration_weeks, paused_at, program_day(position, workout_template(name, day_label))",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position", { referencedTable: "program_day", ascending: true })
    .maybeSingle();

  if (!program || program.paused_at || !program.start_date) return null;

  const start = parseISO(program.start_date);
  const daysSince = differenceInCalendarDays(parseISO(today), start);
  const currentWeek = Math.floor(Math.max(0, daysSince) / 7) + 1;
  if (currentWeek > program.duration_weeks) return null; // block complete

  const days = program.program_day ?? [];
  const daysPerWeek = days.length;
  if (daysPerWeek === 0) return null;

  const weekStart = format(addDays(start, (currentWeek - 1) * 7), "yyyy-MM-dd");
  const windowEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");

  const [sessWeek, skipWeek, sessToday, skipToday] = await Promise.all([
    svc
      .from("session")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id)
      .gte("date", weekStart)
      .lt("date", windowEnd),
    svc
      .from("program_skip")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id)
      .gte("date", weekStart)
      .lt("date", windowEnd),
    svc
      .from("session")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id)
      .eq("date", today),
    svc
      .from("program_skip")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id)
      .eq("date", today),
  ]);

  const doneThisWeek = (sessWeek.count ?? 0) + (skipWeek.count ?? 0);
  if (doneThisWeek >= daysPerWeek) return null; // week's work is done
  if ((sessToday.count ?? 0) + (skipToday.count ?? 0) > 0) return null; // handled today

  const next = days[doneThisWeek % daysPerWeek];
  const tmpl = next?.workout_template;
  const nextName = tmpl?.day_label || tmpl?.name || "your next workout";
  return { programName: program.name, nextName };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ skipped: "CRON_SECRET not set" });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ skipped: "service client unavailable" });
  const web = pushConfigured();
  const ios = apnsConfigured();
  if (!web && !ios) return NextResponse.json({ skipped: "push not configured" });

  const [
    { data: profiles, error: pErr },
    { data: subs, error: sErr },
    { data: devices, error: dErr },
  ] = await Promise.all([
    svc.from("profile").select("user_id, reminder_hour, weekly_recap, recap_sent_on"),
    web
      ? svc
          .from("push_subscription")
          .select("user_id, endpoint, p256dh, auth, timezone, created_at")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Sub[], error: null }),
    ios
      ? svc
          .from("apns_device")
          .select("user_id, token, timezone")
          .order("last_seen_at", { ascending: false })
      : Promise.resolve({ data: [] as Device[], error: null }),
  ]);
  const queryError = pErr ?? sErr ?? dErr;
  if (queryError) {
    return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
  }

  // Group devices by user, newest first: the first seen is the "primary" one.
  const byUser = new Map<string, Sub[]>();
  for (const s of (subs ?? []) as Sub[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }
  const phonesByUser = new Map<string, Device[]>();
  for (const d of (devices ?? []) as Device[]) {
    const list = phonesByUser.get(d.user_id) ?? [];
    list.push(d);
    phonesByUser.set(d.user_id, list);
  }

  let notified = 0;
  let recapped = 0;
  for (const p of profiles ?? []) {
    const userSubs = byUser.get(p.user_id) ?? [];
    const userPhones = phonesByUser.get(p.user_id) ?? [];
    if (userSubs.length === 0 && userPhones.length === 0) continue;

    const send = async (payload: { title: string; body: string; url: string; tag: string }) => {
      let sent = 0;
      for (const s of userSubs) {
        const r = await sendPush(s, payload);
        if (r.ok) sent++;
        else if (r.gone)
          await svc.from("push_subscription").delete().eq("endpoint", s.endpoint);
      }
      for (const d of userPhones) {
        const r = await sendApns(d.token, payload);
        if (r.ok) sent++;
        else if (r.gone) await svc.from("apns_device").delete().eq("token", d.token);
      }
      return sent;
    };

    // "Today" in the user's primary timezone, for the due check and the recap.
    const { date: localDate, hour } = localParts(userPhones[0]?.timezone ?? userSubs[0]?.timezone ?? null);

    // reminder_hour set = reminders on. (Hobby's daily cron runs once a day, so
    // the exact hour can't be honored; the value gates on/off.)
    if (p.reminder_hour != null) {
      const due = await workoutDue(svc, p.user_id, localDate);
      if (due) {
        notified += await send({
          title: "Time to train",
          body: `${due.nextName} is up in ${due.programName}. Climb the ladder.`,
          url: "/log",
          tag: "reminder",
        });
      }
    }

    // The Sunday recap, once a week (recap_sent_on is the week's Monday).
    const week = p.weekly_recap ? recapWeek(localDate, hour) : null;
    if (week && p.recap_sent_on !== week) {
      try {
        const facts = await gatherRecap(svc, p.user_id, week);
        // Opens the week as a card to share.
        const sent = await send({ ...recapMessage(facts), url: `/dashboard?week-card=${week}`, tag: "recap" });
        if (sent > 0) {
          recapped++;
          await svc.from("profile").update({ recap_sent_on: week }).eq("user_id", p.user_id);
        }
      } catch (err) {
        console.error("weekly recap", p.user_id, err);
      }
    }
  }

  return NextResponse.json({ ok: true, notified, recapped });
}

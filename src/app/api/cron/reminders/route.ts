import { timingSafeEqual } from "node:crypto";
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
import { isValidTimeZone } from "@/lib/local-date";
import { countedWorkouts, pausedDays, readPauses, weekDays } from "@/lib/program-week";
import { selectAll } from "@/lib/data/paginate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lifters handled at once: enough to finish in time, few enough not to flood the database or APNs. */
const CONCURRENCY = 6;

type Sub = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string | null;
  created_at: string;
};

/** An iPhone running the app with alerts on, reached through APNs. */
type Device = { user_id: string; token: string; timezone: string | null };

/** Local wall-clock hour (0-23) and date (yyyy-MM-dd) in a given IANA zone
 *  (UTC for a stored one that isn't valid). */
function localParts(tz: string | null): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz && isValidTimeZone(tz) ? tz : "UTC",
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
      "id, name, start_date, duration_weeks, paused_at, pauses, restarted_at, program_day(id, position, workout_template(name, day_label))",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position", { referencedTable: "program_day", ascending: true })
    .maybeSingle();

  if (!program || program.paused_at || !program.start_date) return null;

  const start = parseISO(program.start_date);
  const daysSince = differenceInCalendarDays(parseISO(today), start);
  if (daysSince < 0) return null; // the block hasn't started
  const currentWeek = Math.floor(daysSince / 7) + 1;
  if (currentWeek > program.duration_weeks) return null; // block complete

  const days = program.program_day ?? [];
  if (days.length === 0) return null;

  const weekStart = format(addDays(start, (currentWeek - 1) * 7), "yyyy-MM-dd");
  const windowEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  // The week as Home counts it: by the day each workout was, only workouts
  // that count, through pauses, and not from before a restart (program-week.ts).
  const pauses = readPauses(program.pauses);
  const from = format(addDays(parseISO(weekStart), -pausedDays(pauses)), "yyyy-MM-dd");
  const week = { weekStart, pauses, restartedAt: program.restarted_at };

  const [sessWeek, skipWeek, sessToday, skipToday] = await Promise.all([
    svc
      .from("v_session_summary")
      .select("session_date, created_at, program_day_id")
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .gt("working_sets", 0)
      .or(countedWorkouts())
      .gte("session_date", from)
      .lt("session_date", windowEnd),
    svc
      .from("program_skip")
      .select("date, created_at, program_day_id")
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .gte("date", from)
      .lt("date", windowEnd),
    svc
      .from("session")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .eq("date", today),
    svc
      .from("program_skip")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .eq("date", today),
  ]);

  const workouts = (sessWeek.data ?? []).flatMap((r) =>
    r.session_date && r.created_at
      ? [{ date: r.session_date, created_at: r.created_at, program_day_id: r.program_day_id }]
      : [],
  );
  const { status, next } = weekDays(
    days.map((d) => d.id),
    workouts,
    skipWeek.data ?? [],
    week,
  );
  if (!status.includes(null)) return null; // week's work is done
  if ((sessToday.count ?? 0) + (skipToday.count ?? 0) > 0) return null; // handled today

  const tmpl = days[next]?.workout_template;
  const nextName = tmpl?.day_label || tmpl?.name || "your next workout";
  return { programName: program.name, nextName };
}

/** A constant-time comparison, so response timing can't spell out the secret. */
function sameSecret(given: string | null, expected: string): boolean {
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Claims one notification (a lifter's reminder for a day, or recap for a
 * week) before it's sent. False if a run already claimed it: two runs at
 * once, or a retry, send it once.
 */
async function reserve(svc: Svc, userId: string, kind: "reminder" | "recap", period: string): Promise<boolean> {
  const { error } = await svc.from("notification_log").insert({ user_id: userId, kind, period });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

/** Gives a claim back when nothing reached the lifter, so the next run tries again. */
async function release(svc: Svc, userId: string, kind: "reminder" | "recap", period: string) {
  await svc.from("notification_log").delete().eq("user_id", userId).eq("kind", kind).eq("period", period);
}

/** Runs `work` over `items`, `limit` at a time. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let i = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await work(items[i++]);
  });
  await Promise.all(lanes);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ skipped: "CRON_SECRET not set" });
  }
  if (!sameSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ skipped: "service client unavailable" });

  // Workouts deleted more than 30 days ago go for good (Recently deleted).
  const { data: purged } = await svc.rpc("purge_deleted_sessions");

  const web = pushConfigured();
  const ios = apnsConfigured();
  if (!web && !ios) return NextResponse.json({ skipped: "push not configured", purged });

  // Everyone with somewhere to send to, a page at a time (selectAll), in a
  // stable order. Phones with alerts off only take silent widget pushes.
  const [subs, devices] = await Promise.all([
    web
      ? selectAll<Sub>((from, to) =>
          svc
            .from("push_subscription")
            .select("user_id, endpoint, p256dh, auth, timezone, created_at")
            .order("created_at", { ascending: false })
            .order("endpoint")
            .range(from, to),
        )
      : Promise.resolve([] as Sub[]),
    ios
      ? selectAll<Device>((from, to) =>
          svc
            .from("apns_device")
            .select("user_id, token, timezone")
            .eq("alerts", true)
            .order("last_seen_at", { ascending: false })
            .order("token")
            .range(from, to),
        )
      : Promise.resolve([] as Device[]),
  ]);

  // Group devices by user, newest first: the first seen is the "primary" one.
  const byUser = new Map<string, Sub[]>();
  for (const s of subs) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }
  const phonesByUser = new Map<string, Device[]>();
  for (const d of devices) {
    const list = phonesByUser.get(d.user_id) ?? [];
    list.push(d);
    phonesByUser.set(d.user_id, list);
  }
  const userIds = [...new Set([...byUser.keys(), ...phonesByUser.keys()])].sort();

  // Only the profiles of those lifters, a hundred ids to a read.
  const profiles: { user_id: string; reminder_hour: number | null; weekly_recap: boolean; recap_sent_on: string | null }[] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const { data, error } = await svc
      .from("profile")
      .select("user_id, reminder_hour, weekly_recap, recap_sent_on")
      .in("user_id", userIds.slice(i, i + 100));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    profiles.push(...(data ?? []));
  }

  let notified = 0;
  let recapped = 0;
  let failed = 0;
  await pool(profiles, CONCURRENCY, async (p) => {
    // One lifter's bad data (a stored timezone that isn't one, say) can't
    // stop the run for everyone after them.
    try {
      const userSubs = byUser.get(p.user_id) ?? [];
      const userPhones = phonesByUser.get(p.user_id) ?? [];

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

      // reminder_hour set = reminders on. (Hobby's daily cron runs once a day,
      // at 16:00 UTC; Profile says when that is locally. The value gates on/off.)
      if (p.reminder_hour != null) {
        const due = await workoutDue(svc, p.user_id, localDate);
        if (due && (await reserve(svc, p.user_id, "reminder", localDate))) {
          const sent = await send({
            title: "Time to train",
            body: `${due.nextName} is up in ${due.programName}. Climb the ladder.`,
            url: "/log",
            tag: "reminder",
          });
          if (sent > 0) notified += sent;
          else await release(svc, p.user_id, "reminder", localDate);
        }
      }

      // The Sunday recap, once a week (recap_sent_on is the week's Monday).
      const week = p.weekly_recap ? recapWeek(localDate, hour) : null;
      if (week && p.recap_sent_on !== week && (await reserve(svc, p.user_id, "recap", week))) {
        try {
          const facts = await gatherRecap(svc, p.user_id, week);
          // Opens the week as a card to share.
          const sent = await send({ ...recapMessage(facts), url: `/dashboard?week-card=${week}`, tag: "recap" });
          if (sent > 0) {
            recapped++;
            await svc.from("profile").update({ recap_sent_on: week }).eq("user_id", p.user_id);
          } else {
            await release(svc, p.user_id, "recap", week);
          }
        } catch (err) {
          await release(svc, p.user_id, "recap", week);
          console.error("weekly recap", p.user_id, err);
        }
      }
    } catch (err) {
      failed++;
      console.error("reminders: skipped a user", p.user_id, err);
    }
  });

  return NextResponse.json({ ok: true, lifters: profiles.length, notified, recapped, failed, purged });
}

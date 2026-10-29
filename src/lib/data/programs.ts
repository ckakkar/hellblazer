import "server-only";
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/settings";
import { dateInTimeZone } from "@/lib/local-date";
import { countedWorkouts, pausedDays, readPauses, weekDays, type DayStatus } from "@/lib/program-week";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Program = Database["public"]["Tables"]["program"]["Row"];
export type ProgramDay = Database["public"]["Tables"]["program_day"]["Row"];

export type ProgramDayWithTemplate = ProgramDay & {
  workout_template:
    | {
        id: string;
        name: string;
        day_label: string | null;
        template_exercise: { id: string }[];
      }
    | null;
};

export type ProgramWithDays = Program & {
  program_day: ProgramDayWithTemplate[];
};

/** A program with its days, each day's template, and the template's exercise ids. */
export const PROGRAM_SELECT =
  "*, program_day(*, workout_template(id, name, day_label, template_exercise(id)))";

export async function getPrograms(): Promise<ProgramWithDays[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program")
    .select(PROGRAM_SELECT)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .order("position", { ascending: true, referencedTable: "program_day" });
  if (error) throw error;
  return (data ?? []) as ProgramWithDays[];
}

export async function getProgram(id: string): Promise<ProgramWithDays | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program")
    .select(PROGRAM_SELECT)
    .eq("id", id)
    .order("position", { ascending: true, referencedTable: "program_day" })
    .maybeSingle();
  if (error) throw error;
  return (data as ProgramWithDays | null) ?? null;
}

export type ProgramProgress = {
  program: ProgramWithDays;
  totalWeeks: number;
  currentWeek: number | null; // null when not started
  isCompleted: boolean;
  isPaused: boolean;
  /** Its start date is still to come: no week yet, nothing advances. */
  isUpcoming: boolean;
  daysPerWeek: number;
  sessionsThisWeek: number;
  skipsThisWeek: number;
  doneThisWeek: number;
  /** Each day this week, in the program's order: done, skipped, or open. */
  dayStatus: DayStatus[];
  /** Workouts beyond the days (a day done twice, or more than the plan). */
  extraThisWeek: number;
  weekComplete: boolean;
  nextDay: ProgramDayWithTemplate | null;
  lastAdvance: { kind: "skip" | "session"; label: string } | null;
  weekStart: string | null;
  endDate: string | null;
};

/**
 * Derive live progress for a program (week X of N, adherence, next workout).
 * Reads with the signed-in lifter's client and timezone cookie unless given
 * others: the Apple Watch API passes its own (see src/lib/watch/server.ts).
 */
export async function getProgramProgress(
  program: ProgramWithDays,
  context?: { supabase: SupabaseClient<Database>; timeZone: string },
): Promise<ProgramProgress> {
  const supabase = context?.supabase ?? (await createClient());
  const days = program.program_day;
  const daysPerWeek = days.length;
  const totalWeeks = program.duration_weeks;
  const isPaused = Boolean(program.paused_at);
  // While paused the clock freezes: everything is computed as of the pause.
  // Taken as a date in the lifter's timezone, the calendar sessions and
  // start_date are both in, so the week rolls over at their midnight.
  const nowRef = parseISO(
    dateInTimeZone(
      program.paused_at ? new Date(program.paused_at) : new Date(),
      context?.timeZone ?? (await getTimeZone()),
    ),
  );

  let currentWeek: number | null = null;
  let weekStart: string | null = null;
  let endDate: string | null = null;
  let isCompleted = false;
  let isUpcoming = false;

  if (program.start_date) {
    const start = parseISO(program.start_date);
    endDate = format(addDays(start, totalWeeks * 7 - 1), "yyyy-MM-dd");
    const daysSince = differenceInCalendarDays(nowRef, start);
    // A block that starts on a later date is upcoming, not in week 1.
    isUpcoming = daysSince < 0;
    if (!isUpcoming) {
      const rawWeek = Math.floor(daysSince / 7) + 1;
      isCompleted = rawWeek > totalWeeks;
      currentWeek = Math.min(rawWeek, totalWeeks);
      weekStart = format(addDays(start, (currentWeek - 1) * 7), "yyyy-MM-dd");
    }
  }

  // The week's workouts and skips, each with the day it was, and the latest
  // of each: all in one round-trip (the "last" rows drive the roll-back
  // control). Only workouts that count: with sets, and finished (or left
  // open past the stale clock), so an empty start doesn't use up a day.
  let dayStatus: DayStatus[] = days.map(() => null);
  let extraThisWeek = 0;
  let nextIndex = 0;
  let lastSessionRow: { id: string | null; title: string | null; created_at: string | null } | null = null;
  let lastSkipRow: { id: string; created_at: string } | null = null;
  if (weekStart && program.start_date) {
    const windowEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
    // A workout from before a pause counts where the stopped calendar has it,
    // so the read reaches back as far as the pauses add up to; nothing from
    // before a restart counts (program-week.ts).
    const pauses = readPauses(program.pauses);
    const from = format(addDays(parseISO(weekStart), -pausedDays(pauses)), "yyyy-MM-dd");
    const week = { weekStart, pauses, restartedAt: program.restarted_at };
    const counted = countedWorkouts();
    const [sessionRows, skipRows, lastSession, lastSkip] = await Promise.all([
      supabase
        .from("v_session_summary")
        .select("session_date, created_at, program_day_id")
        .eq("program_id", program.id)
        .gt("working_sets", 0)
        .or(counted)
        .gte("session_date", from)
        .lt("session_date", windowEnd),
      supabase
        .from("program_skip")
        .select("date, created_at, program_day_id")
        .eq("program_id", program.id)
        .gte("date", from)
        .lt("date", windowEnd),
      supabase
        .from("v_session_summary")
        .select("session_id, title, created_at")
        .eq("program_id", program.id)
        .gt("working_sets", 0)
        .or(counted)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("program_skip")
        .select("id, created_at")
        .eq("program_id", program.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (sessionRows.error) throw sessionRows.error;
    if (skipRows.error) throw skipRows.error;
    const workouts = (sessionRows.data ?? []).flatMap((r) =>
      r.session_date && r.created_at
        ? [{ date: r.session_date, created_at: r.created_at, program_day_id: r.program_day_id }]
        : [],
    );
    const result = weekDays(
      days.map((d) => d.id),
      workouts,
      skipRows.data ?? [],
      week,
    );
    dayStatus = result.status;
    extraThisWeek = result.extra;
    nextIndex = result.next;
    lastSessionRow = lastSession.data
      ? { id: lastSession.data.session_id, title: lastSession.data.title, created_at: lastSession.data.created_at }
      : null;
    lastSkipRow = lastSkip.data;
  }

  const sessionsThisWeek = dayStatus.filter((d) => d === "done").length;
  const skipsThisWeek = dayStatus.filter((d) => d === "skipped").length;
  const doneThisWeek = sessionsThisWeek + skipsThisWeek;
  const weekComplete = daysPerWeek > 0 && doneThisWeek >= daysPerWeek;
  // The first day not yet done this week; a finished week leads into next
  // week's first day.
  const nextDay = daysPerWeek > 0 ? (days[nextIndex] ?? days[0]) : null;

  // The most recent advance (for the "Roll back a day" control): whichever of
  // the latest logged session or latest skip happened last. Uses rows already
  // fetched above, so no extra round-trip.
  let lastAdvance: ProgramProgress["lastAdvance"] = null;
  if (doneThisWeek > 0) {
    const sessTime = lastSessionRow?.created_at
      ? new Date(lastSessionRow.created_at).getTime()
      : -1;
    const skipTime = lastSkipRow
      ? new Date(lastSkipRow.created_at).getTime()
      : -1;
    if (sessTime >= 0 || skipTime >= 0) {
      lastAdvance =
        skipTime >= sessTime
          ? { kind: "skip", label: "a skipped day" }
          : {
              kind: "session",
              label: lastSessionRow?.title
                ? `“${lastSessionRow.title}”`
                : "your last logged workout",
            };
    }
  }

  return {
    program,
    totalWeeks,
    currentWeek,
    isCompleted,
    isPaused,
    isUpcoming,
    daysPerWeek,
    sessionsThisWeek,
    skipsThisWeek,
    doneThisWeek,
    dayStatus,
    extraThisWeek,
    weekComplete,
    nextDay,
    lastAdvance,
    weekStart,
    endDate,
  };
}

/** The active program with its progress, or null if none is active. */
export async function getActiveProgramProgress(): Promise<ProgramProgress | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program")
    .select(PROGRAM_SELECT)
    .eq("is_active", true)
    .order("position", { ascending: true, referencedTable: "program_day" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getProgramProgress(data as ProgramWithDays);
}

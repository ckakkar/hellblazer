import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
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

const PROGRAM_SELECT =
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
  daysPerWeek: number;
  sessionsThisWeek: number;
  skipsThisWeek: number;
  doneThisWeek: number;
  weekComplete: boolean;
  nextDay: ProgramDayWithTemplate | null;
  lastAdvance: { kind: "skip" | "session"; label: string } | null;
  weekStart: string | null;
  endDate: string | null;
};

/** Derive live progress for a program (week X of N, adherence, next workout). */
export async function getProgramProgress(
  program: ProgramWithDays,
): Promise<ProgramProgress> {
  const supabase = await createClient();
  const days = program.program_day;
  const daysPerWeek = days.length;
  const totalWeeks = program.duration_weeks;
  const isPaused = Boolean(program.paused_at);
  // While paused the clock freezes: everything is computed as of the pause.
  const nowRef = program.paused_at ? new Date(program.paused_at) : new Date();

  let currentWeek: number | null = null;
  let weekStart: string | null = null;
  let endDate: string | null = null;
  let isCompleted = false;

  if (program.start_date) {
    const start = parseISO(program.start_date);
    endDate = format(addDays(start, totalWeeks * 7 - 1), "yyyy-MM-dd");
    const daysSince = differenceInCalendarDays(nowRef, start);
    const rawWeek = Math.floor(Math.max(0, daysSince) / 7) + 1;
    isCompleted = rawWeek > totalWeeks;
    currentWeek = Math.min(rawWeek, totalWeeks);
    weekStart = format(addDays(start, (currentWeek - 1) * 7), "yyyy-MM-dd");
  }

  // Count sessions logged AND days skipped this week, and grab the latest of
  // each — all in one round-trip (the "last" rows drive the roll-back control).
  let sessionsThisWeek = 0;
  let skipsThisWeek = 0;
  let lastSessionRow: { id: string; title: string | null; created_at: string } | null =
    null;
  let lastSkipRow: { id: string; created_at: string } | null = null;
  if (weekStart && program.start_date) {
    const windowEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
    const [sessionCount, skipCount, lastSession, lastSkip] = await Promise.all([
      supabase
        .from("session")
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id)
        .gte("date", weekStart)
        .lt("date", windowEnd),
      supabase
        .from("program_skip")
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id)
        .gte("date", weekStart)
        .lt("date", windowEnd),
      supabase
        .from("session")
        .select("id, title, created_at")
        .eq("program_id", program.id)
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
    sessionsThisWeek = sessionCount.count ?? 0;
    skipsThisWeek = skipCount.count ?? 0;
    lastSessionRow = lastSession.data;
    lastSkipRow = lastSkip.data;
  }

  const doneThisWeek = sessionsThisWeek + skipsThisWeek;
  const weekComplete = daysPerWeek > 0 && doneThisWeek >= daysPerWeek;
  const nextDay =
    daysPerWeek > 0 ? days[doneThisWeek % daysPerWeek] ?? days[0] : null;

  // The most recent advance (for the "Roll back a day" control) — whichever of
  // the latest logged session or latest skip happened last. Uses rows already
  // fetched above, so no extra round-trip.
  let lastAdvance: ProgramProgress["lastAdvance"] = null;
  if (doneThisWeek > 0) {
    const sessTime = lastSessionRow
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
    daysPerWeek,
    sessionsThisWeek,
    skipsThisWeek,
    doneThisWeek,
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

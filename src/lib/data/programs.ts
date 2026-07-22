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
  daysPerWeek: number;
  sessionsThisWeek: number;
  skipsThisWeek: number;
  doneThisWeek: number;
  weekComplete: boolean;
  nextDay: ProgramDayWithTemplate | null;
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

  let currentWeek: number | null = null;
  let weekStart: string | null = null;
  let endDate: string | null = null;
  let isCompleted = false;

  if (program.start_date) {
    const start = parseISO(program.start_date);
    endDate = format(addDays(start, totalWeeks * 7 - 1), "yyyy-MM-dd");
    const daysSince = differenceInCalendarDays(new Date(), start);
    const rawWeek = Math.floor(Math.max(0, daysSince) / 7) + 1;
    isCompleted = rawWeek > totalWeeks;
    currentWeek = Math.min(rawWeek, totalWeeks);
    weekStart = format(addDays(start, (currentWeek - 1) * 7), "yyyy-MM-dd");
  }

  // Count sessions logged AND days skipped within the current program-week.
  let sessionsThisWeek = 0;
  let skipsThisWeek = 0;
  if (weekStart && program.start_date) {
    const windowEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
    const [sessionCount, skipCount] = await Promise.all([
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
    ]);
    sessionsThisWeek = sessionCount.count ?? 0;
    skipsThisWeek = skipCount.count ?? 0;
  }

  const doneThisWeek = sessionsThisWeek + skipsThisWeek;
  const weekComplete = daysPerWeek > 0 && doneThisWeek >= daysPerWeek;
  const nextDay =
    daysPerWeek > 0 ? days[doneThisWeek % daysPerWeek] ?? days[0] : null;

  return {
    program,
    totalWeeks,
    currentWeek,
    isCompleted,
    daysPerWeek,
    sessionsThisWeek,
    skipsThisWeek,
    doneThisWeek,
    weekComplete,
    nextDay,
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

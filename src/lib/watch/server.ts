import { createHash } from "node:crypto";
import { APPEND } from "@/lib/positions";
import { after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isStraight } from "@/lib/set-kinds";
import {
  getProgramProgress,
  PROGRAM_SELECT,
  type ProgramWithDays,
} from "@/lib/data/programs";
import { format, parseISO, startOfISOWeek } from "date-fns";
import { dateInTimeZone, isValidTimeZone } from "@/lib/local-date";
import { fromDisplayWeight, toDisplayWeight, type Unit } from "@/lib/units";
import { STALE_CLOCK_MS } from "@/lib/workout-clock";
import { bearerToken, hashWatchToken } from "@/lib/watch/token";
import { refreshWidgets, widgetDevices } from "@/lib/widget-push";
import {
  activitySummary,
  exerciseForNextSet,
  isComplete,
  restsAfter,
  sameAgain,
} from "@/lib/watch/next-set";
import { describeSpokenSets, parseHeard, planSpokenSets } from "@/lib/spoken-sets";
import { nextTarget } from "@/lib/progression";
import type {
  WatchExercise,
  WatchPlanExercise,
  WatchStartOption,
  WatchState,
  WatchTarget,
  WatchWeek,
  WatchWorkout,
} from "@/lib/watch/protocol";

type Svc = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * A request from the Apple Watch app, resolved to its lifter. The watch has
 * no Supabase session, only the token the iPhone app gave it, so this runs
 * with the service role: EVERY query here scopes itself with
 * `.eq("user_id", userId)`, the same rule as the strength judge.
 */
export type WatchContext = {
  db: Svc;
  userId: string;
  unit: Unit;
  timeZone: string;
};

class WatchError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Which device a token was minted for (watch_link.kind). Each endpoint takes
 * one: the watch's token can start, log and finish workouts; the phone's can
 * read the widget snapshot and log a set by voice (logVoiceSet), nothing
 * more.
 */
export type DeviceKind = "watch" | "phone";

/** How long a device token lasts unused. */
const TOKEN_IDLE_MS = 90 * 24 * 60 * 60 * 1000;

async function resolve(db: Svc, request: Request, kind: DeviceKind): Promise<WatchContext | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const { data: link, error } = await db
    .from("watch_link")
    .select("id, user_id, last_seen_at, created_at")
    .eq("token_hash", hashWatchToken(token))
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;
  // A token left unused for 90 days (a sold or drawer-bound watch) stops
  // working and goes. A device still in use never gets there, and one that
  // comes back is linked again by the iPhone app (DeviceSync) on opening.
  if (Date.now() - Date.parse(link.last_seen_at ?? link.created_at) > TOKEN_IDLE_MS) {
    await db.from("watch_link").delete().eq("id", link.id);
    return null;
  }
  // Settings shows when each watch was last seen; an hour is plenty precise.
  if (!link.last_seen_at || Date.now() - Date.parse(link.last_seen_at) > 60 * 60 * 1000) {
    await db
      .from("watch_link")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", link.id);
  }
  const zone = [request.headers.get("x-fatty-tz"), request.headers.get("x-vercel-ip-timezone")].find(
    (z): z is string => Boolean(z) && isValidTimeZone(z as string),
  );
  return {
    db,
    userId: link.user_id,
    unit: request.headers.get("x-fatty-unit") === "lb" ? "lb" : "kg",
    timeZone: zone ?? "UTC",
  };
}

/**
 * Runs one device API call: 401 when the token is missing, was revoked, or
 * was minted for the other kind of device (the watch then asks the iPhone
 * for a new one), 400 for a malformed body.
 */
export async function handleWatch(
  request: Request,
  run: (ctx: WatchContext) => Promise<unknown>,
  kind: DeviceKind = "watch",
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const db = createServiceClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers });
  try {
    const ctx = await resolve(db, request, kind);
    if (!ctx) return Response.json({ error: "unlinked" }, { status: 401, headers });
    return Response.json(await run(ctx), { headers });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "invalid" }, { status: 400, headers });
    }
    if (err instanceof WatchError) {
      return Response.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("watch api", err);
    return Response.json({ error: "failed" }, { status: 500, headers });
  }
}

/**
 * Everything the watch shows: the workout in progress and what it can
 * start. With none on, each day it can start carries its plan, so it can
 * start one with no connection.
 */
export async function watchState(ctx: WatchContext): Promise<WatchState> {
  const [active, { planned, ...start }, week] = await Promise.all([
    activeWorkout(ctx),
    startOptions(ctx),
    thisWeek(ctx),
  ]);
  if (!active) {
    const [plans, finished] = await Promise.all([
      startPlans(ctx, start.options.map((o) => o.templateId)),
      recentlyFinished(ctx),
    ]);
    const withPlan = (o: WatchStartOption) => ({ ...o, plan: plans.get(o.templateId) ?? [] });
    start.options = start.options.map(withPlan);
    if (start.next) start.next = withPlan(start.next);
    return { unit: ctx.unit, active, ...start, week: { ...week, planned }, finished };
  }
  return { unit: ctx.unit, active, ...start, week: { ...week, planned } };
}

/** Sessions finished in the last day: how the watch tells a finish from a discard. */
async function recentlyFinished(ctx: WatchContext): Promise<string[]> {
  const { data, error } = await ctx.db
    .from("session")
    .select("id")
    .eq("user_id", ctx.userId)
    .gte("finished_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if (error) throw error;
  return (data ?? []).map((s) => s.id);
}

/** Each template's exercises in order, with targets, rest and last time's sets. */
async function startPlans(ctx: WatchContext, templateIds: string[]): Promise<Map<string, WatchPlanExercise[]>> {
  const plans = new Map<string, WatchPlanExercise[]>();
  if (templateIds.length === 0) return plans;
  const { db, userId } = ctx;
  const { data: rows, error } = await db
    .from("template_exercise")
    .select(
      "template_id, position, exercise_id, target_sets, target_rep_range, rest_seconds, superset, exercise(name, equipment, mechanic, primary_muscle)",
    )
    .eq("user_id", userId)
    .in("template_id", templateIds)
    .order("position", { ascending: true });
  if (error) throw error;
  const last = await lastPerformances(ctx, [...new Set((rows ?? []).map((r) => r.exercise_id))], null);
  for (const row of [...(rows ?? [])].sort((a, b) => a.position - b.position)) {
    const list = plans.get(row.template_id) ?? [];
    const past = last.get(row.exercise_id) ?? [];
    list.push({
      name: row.exercise?.name ?? "Exercise",
      targetSets: row.target_sets,
      targetReps: row.target_rep_range,
      restSeconds: row.rest_seconds,
      last: past.map(({ weight, reps }) => ({ weight, reps })),
      target: targetOf(past, row.target_rep_range, row.target_sets, row.exercise, ctx.unit),
      superset: row.superset ?? null,
      exerciseId: row.exercise_id,
    });
    plans.set(row.template_id, list);
  }
  return plans;
}

type PastSet = { weight: number; reps: number; rpe: number | null };

/** The previous session's working sets per movement (display unit), for copy-forward. */
async function lastPerformances(
  ctx: WatchContext,
  exerciseIds: string[],
  excludeSession: string | null,
): Promise<Map<string, PastSet[]>> {
  const last = new Map<string, PastSet[]>();
  if (exerciseIds.length === 0) return last;
  const { data, error } = await ctx.db.rpc("watch_last_performances", {
    p_user: ctx.userId,
    p_exercise_ids: exerciseIds,
    ...(excludeSession ? { p_exclude_session: excludeSession } : {}),
  });
  if (error) throw error;
  for (const row of data ?? []) {
    const list = last.get(row.exercise_id) ?? [];
    list.push({
      weight: toDisplayWeight(Number(row.weight_kg), ctx.unit),
      reps: row.reps,
      rpe: row.rpe == null ? null : Number(row.rpe),
    });
    last.set(row.exercise_id, list);
  }
  return last;
}

/** Sessions and working sets since Monday, in the lifter's calendar. */
async function thisWeek(ctx: WatchContext): Promise<Omit<WatchWeek, "planned">> {
  const start = format(startOfISOWeek(parseISO(dateInTimeZone(new Date(), ctx.timeZone))), "yyyy-MM-dd");
  const { data, error } = await ctx.db
    .from("v_session_summary")
    .select("working_sets")
    .eq("user_id", ctx.userId)
    .gte("session_date", start);
  if (error) throw error;
  return {
    start,
    sessions: (data ?? []).length,
    sets: (data ?? []).reduce((n, s) => n + Number(s.working_sets ?? 0), 0),
  };
}

/**
 * The newest unfinished session, like the resume banner's, but not one left
 * open for hours: that's a forgotten session, not a workout on the wrist.
 */
async function activeWorkout(ctx: WatchContext): Promise<WatchWorkout | null> {
  const { db, userId } = ctx;
  const { data: session, error } = await db
    .from("session")
    .select("id, title, created_at, template_id")
    .eq("user_id", userId)
    .is("finished_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;
  if (Date.now() - Date.parse(session.created_at) > STALE_CLOCK_MS) return null;
  return workoutOf(ctx, session);
}

/** A session as the watch shows it, however long ago it started. */
async function workoutOf(
  ctx: WatchContext,
  session: { id: string; title: string | null; created_at: string },
): Promise<WatchWorkout> {
  const { db, userId, unit } = ctx;
  const startedAt = Date.parse(session.created_at);

  // Targets are the session's own, copied from the template when it
  // started (start_session), so a template edited since doesn't move them.
  const { data, error: rowsError } = await db
    .from("session_exercise")
    .select(
      "id, exercise_id, position, superset, target_sets, target_rep_range, rest_seconds, ended_at, exercise(name, equipment, mechanic, primary_muscle), set(id, set_number, weight_kg, reps, is_warmup, kind)",
    )
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (rowsError) throw rowsError;
  const rows = data ?? [];

  // The previous session's working sets per movement, for copy-forward.
  const last = await lastPerformances(ctx, [...new Set(rows.map((r) => r.exercise_id))], session.id);

  const exercises: WatchExercise[] = rows.map((row) => {
    const past = last.get(row.exercise_id) ?? [];
    return {
      id: row.id,
      name: row.exercise?.name ?? "Exercise",
      targetSets: row.target_sets,
      targetReps: row.target_rep_range,
      restSeconds: row.rest_seconds,
      sets: [...row.set]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          id: s.id,
          n: s.set_number,
          weight: toDisplayWeight(Number(s.weight_kg), unit),
          reps: s.reps,
          warmup: s.is_warmup,
          kind: s.kind,
        })),
      last: past.map(({ weight, reps }) => ({ weight, reps })),
      target: targetOf(past, row.target_rep_range, row.target_sets, row.exercise, unit),
      superset: row.superset ?? null,
      ended: row.ended_at != null,
    };
  });

  return { id: session.id, title: session.title ?? "Workout", startedAt, exercises };
}

/** Today's numbers for a lift from last time's (progression.ts). */
function targetOf(
  past: PastSet[],
  range: string | null,
  plannedSets: number | null,
  exercise: { equipment: string | null; mechanic: string | null; primary_muscle: string | null } | null,
  unit: Unit,
): WatchTarget | null {
  const t = nextTarget({
    last: past,
    range,
    plannedSets,
    lift: {
      equipment: exercise?.equipment ?? null,
      mechanic: exercise?.mechanic ?? null,
      primaryMuscle: exercise?.primary_muscle ?? null,
    },
    unit,
  });
  return t ? { weight: t.weight, reps: t.reps } : null;
}

/** What /log offers: the active program's days, else every template. */
async function startOptions(
  ctx: WatchContext,
): Promise<{ next: WatchStartOption | null; options: WatchStartOption[]; planned: number | null }> {
  const { db, userId, timeZone } = ctx;
  const { data, error } = await db
    .from("program")
    .select(PROGRAM_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position", { ascending: true, referencedTable: "program_day" })
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const program = data as ProgramWithDays;
    const options: WatchStartOption[] = [];
    const seen = new Set<string>();
    for (const day of program.program_day) {
      const template = day.workout_template;
      if (!template || seen.has(template.id)) continue;
      seen.add(template.id);
      options.push({
        templateId: template.id,
        programDayId: day.id,
        label: template.day_label || template.name,
        exercises: template.template_exercise.length,
      });
    }
    const progress = await getProgramProgress(program, { supabase: db, timeZone });
    const nextTemplate = progress.nextDay?.workout_template;
    const next =
      // Paused or not yet started: nothing is due, so nothing's offered as
      // the next programmed day (starting one would advance the block).
      !progress.isCompleted && !progress.isPaused && !progress.isUpcoming && progress.nextDay && nextTemplate
        ? {
            templateId: nextTemplate.id,
            programDayId: progress.nextDay.id,
            label: nextTemplate.day_label || nextTemplate.name,
            exercises: nextTemplate.template_exercise.length,
          }
        : null;
    return { next, options, planned: progress.daysPerWeek };
  }

  const { data: templates, error: templateError } = await db
    .from("workout_template")
    .select("id, name, day_label, template_exercise(id)")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (templateError) throw templateError;
  return {
    planned: null,
    next: null,
    options: (templates ?? []).map((t) => ({
      templateId: t.id,
      programDayId: null,
      label: t.day_label || t.name,
      exercises: t.template_exercise.length,
    })),
  };
}

const startSchema = z.object({
  templateId: z.string().uuid(),
  programDayId: z.string().uuid().nullish(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** When it really began (epoch ms): a workout started offline reaches the
   *  server later. Older watch builds don't send it. */
  startedAt: z.number().optional(),
  /** An offline workout's movements (library ids, 2.8 on): any the session
   *  doesn't have (the day changed while the watch was away) are added, so
   *  their sets have somewhere to go. */
  exercises: z.array(z.string().uuid()).max(40).optional(),
});

/** Adds to a session the movements an offline workout had that it lacks. */
async function addMissingExercises(ctx: WatchContext, sessionId: string, exerciseIds: string[] | undefined) {
  if (!exerciseIds?.length) return;
  const { data: have } = await ctx.db
    .from("session_exercise")
    .select("exercise_id")
    .eq("session_id", sessionId)
    .eq("user_id", ctx.userId);
  const present = new Set((have ?? []).map((r) => r.exercise_id));
  for (const exerciseId of new Set(exerciseIds)) {
    if (present.has(exerciseId)) continue;
    // One that's gone from the library (or isn't theirs) is skipped; the
    // watch says which sets had nowhere to go.
    await ctx.db
      .from("session_exercise")
      .insert({ user_id: ctx.userId, session_id: sessionId, exercise_id: exerciseId, position: APPEND });
  }
}

/** A time the watch says something happened, if it's believable: in the
 *  last day, and not ahead of the server's clock by more than a minute. */
function watchTime(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms)) return null;
  const now = Date.now();
  return ms > now - 24 * 60 * 60 * 1000 && ms < now + 60 * 1000 ? new Date(ms).toISOString() : null;
}

/**
 * Starts a session from a template, through the same start_session() the web
 * uses (one transaction; as the service role, the user is passed in). A
 * second tap, or a start on the phone a moment ago, returns the session
 * already in progress instead of opening another.
 */
export async function startWatchWorkout(ctx: WatchContext, body: unknown): Promise<WatchState> {
  const v = startSchema.parse(body);
  const startedAt = watchTime(v.startedAt);
  // A workout started offline that reaches the server late, retried: the
  // session it made the first time (its start time is the watch's) is the
  // one, not another. Returned as `started` even if it's too old to be the
  // live workout, so the watch can move its sets over either way.
  if (startedAt) {
    const { data: made } = await ctx.db
      .from("session")
      .select("id, title, created_at")
      .eq("user_id", ctx.userId)
      .eq("created_at", startedAt)
      .limit(1)
      .maybeSingle();
    if (made) {
      await addMissingExercises(ctx, made.id, v.exercises);
      return { ...(await watchState(ctx)), started: await workoutOf(ctx, made) };
    }
  }
  // Another workout's open. A start from the watch's list just shows it;
  // an offline workout catching up is told it wasn't started, so its sets
  // aren't moved onto that one.
  if (await activeWorkout(ctx)) return startedAt ? { ...(await watchState(ctx)), conflict: true } : watchState(ctx);
  const { data: sessionId, error } = await ctx.db.rpc("start_session", {
    p_user: ctx.userId,
    ...(v.programDayId ? { p_program_day_id: v.programDayId } : { p_template_id: v.templateId }),
    p_date: v.localDate,
  });
  if (error) {
    // start_session raises "… not found" for a day or template that isn't theirs.
    throw error.code === "P0001" ? new WatchError(404, "not found") : error;
  }
  // Started offline: the session began when the watch says, not now, so its
  // clock (and the heart-rate read later) line up. Only a session this call
  // just opened; one that was already under way keeps its own.
  if (startedAt && sessionId) {
    await ctx.db
      .from("session")
      .update({ created_at: startedAt })
      .eq("id", sessionId)
      .eq("user_id", ctx.userId)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  }
  const { data: made } = sessionId
    ? await ctx.db.from("session").select("id, title, created_at").eq("id", sessionId).eq("user_id", ctx.userId).maybeSingle()
    : { data: null };
  if (made && startedAt) await addMissingExercises(ctx, made.id, v.exercises);
  const state = await watchState(ctx);
  return made ? { ...state, started: await workoutOf(ctx, made) } : state;
}

const setSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1).max(999),
  weight: z.number().min(0).max(9999),
  // At least a rep (the database holds every set to it); a refusal the
  // watch drops rather than retries.
  reps: z.number().int().min(1).max(999),
  /** The unit the weight was logged in. A set queued offline can reach the
   *  server after the lifter switched units; older watch builds omit it. */
  unit: z.enum(["kg", "lb"]).optional(),
  /** When it was logged (epoch ms), for a set that waited for a connection. */
  loggedAt: z.number().optional(),
});

/** Saves a working set, keyed on the watch's own id so a retry can't double it. */
export async function saveWatchSet(ctx: WatchContext, body: unknown): Promise<{ ok: true }> {
  const v = setSchema.parse(body);
  const { db, userId, unit } = ctx;
  const { data: owner } = await db
    .from("session_exercise")
    .select("id")
    .eq("id", v.sessionExerciseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!owner) throw new WatchError(404, "not found");

  const row = {
    session_exercise_id: owner.id,
    set_number: v.setNumber,
    weight_kg: fromDisplayWeight(v.weight, v.unit ?? unit),
    reps: v.reps,
    is_warmup: false,
    is_completed: true,
  };
  const loggedAt = watchTime(v.loggedAt);
  // Update, then insert: an upsert on a caller-chosen id could overwrite
  // someone else's set; this only ever touches the caller's own rows.
  const { data: updated, error } = await db
    .from("set")
    .update(row)
    .eq("id", v.id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) {
    const { error: insertError } = await db
      .from("set")
      .insert({ id: v.id, user_id: userId, ...row, ...(loggedAt ? { created_at: loggedAt } : {}) });
    // 23505: that id exists but isn't the caller's to change.
    if (insertError) {
      throw insertError.code === "23505" ? new WatchError(409, "conflict") : insertError;
    }
  }
  return { ok: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteWatchSet(ctx: WatchContext, body: unknown): Promise<{ ok: true }> {
  const { id } = deleteSchema.parse(body);
  const { error } = await ctx.db.from("set").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) throw error;
  return { ok: true };
}

const finishSchema = z.object({
  sessionId: z.string().uuid(),
  durationMin: z.number().int().min(0).max(1000).nullish(),
});

/** Finishes the session, as finishSession does on the web. */
export async function finishWatchWorkout(ctx: WatchContext, body: unknown): Promise<WatchState> {
  const v = finishSchema.parse(body);
  const { db, userId } = ctx;
  const { data: current } = await db
    .from("session")
    .select("finished_at")
    .eq("id", v.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!current) throw new WatchError(404, "not found");
  const patch: { finished_at?: string; duration_min?: number } = {};
  if (!current.finished_at) patch.finished_at = new Date().toISOString();
  if (v.durationMin != null) patch.duration_min = v.durationMin;
  if (Object.keys(patch).length > 0) {
    const { error } = await db
      .from("session")
      .update(patch)
      .eq("id", v.sessionId)
      .eq("user_id", userId);
    if (error) throw error;
  }
  // The iPhone's widgets catch up on their own (a silent push).
  const devices = await widgetDevices(db, userId).catch(() => []);
  after(() => refreshWidgets(devices));
  return watchState(ctx);
}

const voiceSetSchema = z
  .object({
    weight: z.number().min(0).max(9999).optional(),
    reps: z.number().int().min(1).max(999).optional(),
    /** The Lock Screen's Log Set names the exercise it showed. */
    sessionExerciseId: z.string().uuid().optional(),
    /** The command's own id, the same on every retry of it (2.8 on): the
     *  set's id, so a retry after a lost reply logs nothing twice. */
    operationId: z.string().uuid().optional(),
  })
  .refine((v) => (v.weight === undefined) === (v.reps === undefined));

type LoggedSet = { id: string; set_number: number; existed: boolean };

/**
 * Saves sets through log_sets(): each numbered after the last one on its
 * exercise under a lock, so two commands at once can't share a number, and
 * a set whose id is already in comes back as it is, so a retry adds nothing.
 */
async function logSets(
  ctx: WatchContext,
  rows: {
    id: string;
    session_exercise_id: string;
    weight_kg: number;
    reps: number;
    rpe?: number | null;
    is_warmup?: boolean;
  }[],
): Promise<LoggedSet[]> {
  const { data, error } = await ctx.db.rpc("log_sets", { p_rows: rows, p_user: ctx.userId });
  if (error) throw error.message.includes("conflict") ? new WatchError(409, "conflict") : error;
  return (data ?? []) as LoggedSet[];
}

/** The id of a command's `i`th set: the same on every retry of the command. */
function operationSetId(operationId: string, i: number): string {
  const h = createHash("sha256").update(`${operationId}:${i}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Activity = ReturnType<typeof activitySummary>;

export type VoiceSetReply =
  | { status: "no-workout" }
  | { status: "no-numbers"; exercise: string }
  | { status: "all-done" }
  | {
      status: "logged";
      exercise: string;
      weight: number;
      reps: number;
      unit: Unit;
      /** Its place among the exercise's working sets, 1-based. */
      setNumber: number;
      targetSets: number | null;
      /** The rest after it (the template's), or null for the lifter's usual. */
      restSeconds: number | null;
      /** That set was the plan's last. */
      complete: boolean;
      /** A rest comes next; not when a superset partner is up (restsAfter). */
      rest: boolean;
      /** The exercise the next set goes to, when it isn't this one. */
      nextExercise: string | null;
      /** The workout for the Live Activity (activitySummary). */
      activity: Activity;
    };

/** The workout for the Live Activity, as it stands. */
function summarize(workout: WatchWorkout, unit: Unit): { complete: boolean; activity: Activity } {
  const complete = isComplete(workout.exercises);
  const current = exerciseForNextSet(workout.exercises);
  return { complete, activity: activitySummary(workout, current, complete, unit) };
}

/**
 * A set logged from the iPhone without the page (ios/App/App/
 * VoiceSetLogger.swift): Siri, the Action button, Control Center, and the
 * Live Activity's Log Set. With no numbers it's "same again". The exercise
 * follows the shared rules (next-set.ts) unless the Lock Screen named the
 * one it showed; the set is saved as the watch saves one, and the page
 * picks it up when it next looks.
 */
export async function logVoiceSet(ctx: WatchContext, body: unknown): Promise<VoiceSetReply> {
  const v = voiceSetSchema.parse(body ?? {});
  const found = await activeWorkout(ctx);
  if (!found || found.exercises.length === 0) return { status: "no-workout" };
  // A retry of a command that already landed: answered as the first time
  // was, from the workout as it was before it.
  const already = v.operationId
    ? found.exercises.find((e) => e.sets.some((s) => s.id === v.operationId))
    : undefined;
  const workout = already
    ? { ...found, exercises: found.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.id !== v.operationId) })) }
    : found;

  const repeat = v.weight === undefined || v.reps === undefined;
  // Every set's in: "same again" means they think there's one left, so say
  // so rather than add one. Numbers said out loud are an extra set.
  if (repeat && isComplete(workout.exercises)) return { status: "all-done" };

  const exercise = already
    ? (workout.exercises.find((e) => e.id === already.id) ?? null)
    : v.sessionExerciseId
      ? (workout.exercises.find((e) => e.id === v.sessionExerciseId) ?? null)
      : exerciseForNextSet(workout.exercises);
  if (!exercise) return { status: "no-workout" };
  const landed = already?.sets.find((s) => s.id === v.operationId);
  const numbers = landed
    ? { weight: landed.weight, reps: landed.reps }
    : repeat
      ? sameAgain(exercise)
      : { weight: v.weight!, reps: v.reps! };
  if (!numbers) return { status: "no-numbers", exercise: exercise.name };

  const id = v.operationId ?? crypto.randomUUID();
  const [saved] = await logSets(ctx, [
    {
      id,
      session_exercise_id: exercise.id,
      weight_kg: fromDisplayWeight(numbers.weight, ctx.unit),
      reps: numbers.reps,
    },
  ]);
  const setNumber = saved?.set_number ?? Math.max(0, ...exercise.sets.map((s) => s.n)) + 1;

  const logged = {
    ...exercise,
    sets: [...exercise.sets, { id, n: setNumber, weight: numbers.weight, reps: numbers.reps, warmup: false }],
  };
  const after = { ...workout, exercises: workout.exercises.map((e) => (e.id === exercise.id ? logged : e)) };
  const { complete, activity } = summarize(after, ctx.unit);
  const next = exerciseForNextSet(after.exercises);
  return {
    status: "logged",
    exercise: exercise.name,
    weight: numbers.weight,
    reps: numbers.reps,
    unit: ctx.unit,
    setNumber: logged.sets.filter(isStraight).length,
    targetSets: exercise.targetSets,
    restSeconds: exercise.restSeconds,
    complete,
    rest: restsAfter(after.exercises, exercise.id),
    nextExercise: next && next.id !== exercise.id ? next.name : null,
    activity,
  };
}

export type VoiceUndoReply =
  | { status: "no-workout" }
  | { status: "nothing" }
  | {
      status: "undone";
      /** The set taken back, for the page to drop too. */
      setId: string;
      sessionId: string;
      exercise: string;
      weight: number;
      reps: number;
      unit: Unit;
      activity: Activity;
    };

/** "Undo my last set": takes back the working set logged most recently. */
export async function undoVoiceSet(ctx: WatchContext): Promise<VoiceUndoReply> {
  const workout = await activeWorkout(ctx);
  if (!workout) return { status: "no-workout" };
  const { data: latest, error } = await ctx.db
    .from("set")
    .select("id, session_exercise_id")
    .eq("user_id", ctx.userId)
    .eq("is_warmup", false)
    .in(
      "session_exercise_id",
      workout.exercises.map((e) => e.id),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const exercise = workout.exercises.find((e) => e.id === latest?.session_exercise_id);
  const set = exercise?.sets.find((s) => s.id === latest?.id);
  if (!latest || !exercise || !set) return { status: "nothing" };

  await deleteWatchSet(ctx, { id: set.id });
  const after = {
    ...workout,
    exercises: workout.exercises.map((e) =>
      e.id === exercise.id ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) } : e,
    ),
  };
  return {
    status: "undone",
    setId: set.id,
    sessionId: workout.id,
    exercise: exercise.name,
    weight: set.weight,
    reps: set.reps,
    unit: ctx.unit,
    activity: summarize(after, ctx.unit).activity,
  };
}

export type SpokenWorkoutReply =
  | { status: "no-workout" }
  | {
      status: "ok";
      unit: Unit;
      /** The workout's exercises, for the on-device model to pick from. */
      exercises: string[];
    };

/** What "Log a set" in your own words reads against: the workout's exercise names. */
export async function spokenWorkout(ctx: WatchContext): Promise<SpokenWorkoutReply> {
  const workout = await activeWorkout(ctx);
  if (!workout || workout.exercises.length === 0) return { status: "no-workout" };
  return { status: "ok", unit: ctx.unit, exercises: workout.exercises.map((e) => e.name) };
}

const heardSchema = z.object({
  heard: z.array(z.unknown()).max(12),
  /** The command's own id, the same on every retry of it (2.8 on). */
  operationId: z.string().uuid().optional(),
});

export type HeardSetsReply =
  | { status: "no-workout" }
  /** Nothing in it could be logged; `unmatched` says what wasn't in the workout. */
  | { status: "nothing"; unmatched: string[] }
  | {
      status: "logged";
      count: number;
      /** "3 sets of 8 at 80 kg on Incline Dumbbell Press, the last at RPE 9". */
      said: string;
      unmatched: string[];
      /** The rest after the last set (its exercise's template), or null for the lifter's usual. */
      restSeconds: number | null;
      /** The last set was a warm-up: no rest for that. */
      warmup: boolean;
      /** A rest comes next; not when a superset partner is up (restsAfter). */
      rest: boolean;
      complete: boolean;
      activity: Activity;
    };

/**
 * Sets said to Siri in the lifter's own words, as the iPhone's on-device
 * model heard them (VoiceSetLogger.logSpoken): matched to the workout and
 * filled in by the same rules as the logger's "Say it" (spoken-sets.ts),
 * then saved with their effort and warm-ups.
 */
export async function logHeardSets(ctx: WatchContext, body: unknown): Promise<HeardSetsReply> {
  const v = heardSchema.parse(body ?? {});
  const groups = parseHeard(v.heard);
  const found = await activeWorkout(ctx);
  if (!found || found.exercises.length === 0) return { status: "no-workout" };
  // Each set's id comes from the command's, so a retry plans against the
  // workout as it was before the first try, gets the same sets with the
  // same ids, and log_sets adds none of them twice.
  const ids = (i: number) => (v.operationId ? operationSetId(v.operationId, i) : crypto.randomUUID());
  const mine = new Set(v.operationId ? Array.from({ length: 200 }, (_, i) => operationSetId(v.operationId!, i)) : []);
  const workout = {
    ...found,
    exercises: found.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => !mine.has(s.id)) })),
  };

  const current = exerciseForNextSet(workout.exercises);
  const { sets, unmatched } = planSpokenSets(
    groups,
    workout.exercises.map((e) => ({ id: e.id, name: e.name, same: sameAgain(e) })),
    { unit: ctx.unit, current: current?.id ?? null },
  );
  if (sets.length === 0) return { status: "nothing", unmatched };

  // Session exercise ids come from the lifter's own workout above; the
  // numbers come back from log_sets, after whatever's on each exercise.
  const saved = await logSets(
    ctx,
    sets.slice(0, 200).map((s, i) => ({
      id: ids(i),
      session_exercise_id: s.exerciseId,
      weight_kg: fromDisplayWeight(s.weight, ctx.unit),
      reps: s.reps,
      rpe: s.rpe,
      is_warmup: s.warmup,
    })),
  );
  const rows = saved.map((r, i) => ({ id: r.id, session_exercise_id: sets[i].exerciseId, set_number: r.set_number }));

  const after = {
    ...workout,
    exercises: workout.exercises.map((e) => ({
      ...e,
      sets: [
        ...e.sets,
        ...rows
          .map((r, i) => ({ r, s: sets[i] }))
          .filter(({ r }) => r.session_exercise_id === e.id)
          .map(({ r, s }) => ({ id: r.id, n: r.set_number, weight: s.weight, reps: s.reps, warmup: s.warmup })),
      ],
    })),
  };
  const { complete, activity } = summarize(after, ctx.unit);
  const last = sets[sets.length - 1];
  return {
    status: "logged",
    count: sets.length,
    said: describeSpokenSets(sets, new Map(workout.exercises.map((e) => [e.id, e.name])), ctx.unit),
    unmatched,
    restSeconds: workout.exercises.find((e) => e.id === last.exerciseId)?.restSeconds ?? null,
    warmup: last.warmup,
    rest: !last.warmup && restsAfter(after.exercises, last.exerciseId),
    complete,
    activity,
  };
}

export type VoiceFinishReply =
  | { status: "no-workout" }
  | {
      status: "finished";
      sessionId: string;
      title: string;
      /** Epoch ms. */
      startedAt: number;
      durationMin: number;
      sets: number;
      /** Formatted in the lifter's unit, "7,420 kg". */
      volume: string;
      /** The session's average RPE (1-10), for Apple Health's effort; null without any. */
      effort: number | null;
    };

/**
 * "Finish my workout": finishes the session in progress as the watch does,
 * timed from its start. The phone then saves it to Apple Health.
 */
export async function finishVoiceWorkout(ctx: WatchContext): Promise<VoiceFinishReply> {
  const workout = await activeWorkout(ctx);
  if (!workout) return { status: "no-workout" };
  const minutes = Math.round((Date.now() - workout.startedAt) / 60_000);
  const durationMin = Math.min(360, Math.max(1, minutes));

  const { data: rated, error } = await ctx.db
    .from("set")
    .select("rpe")
    .eq("user_id", ctx.userId)
    .eq("is_warmup", false)
    .in(
      "session_exercise_id",
      workout.exercises.map((e) => e.id),
    )
    .not("rpe", "is", null);
  if (error) throw error;
  const rpes = (rated ?? []).map((r) => Number(r.rpe)).filter((n) => Number.isFinite(n));
  const effort = rpes.length
    ? Math.min(10, Math.max(1, Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length)))
    : null;

  await finishWatchWorkout(ctx, { sessionId: workout.id, durationMin });
  const sets = workout.exercises.flatMap((e) => e.sets.filter((s) => !s.warmup));
  const volume = sets.reduce((n, s) => n + s.weight * s.reps, 0);
  return {
    status: "finished",
    sessionId: workout.id,
    title: workout.title,
    startedAt: workout.startedAt,
    durationMin,
    sets: sets.length,
    volume: `${Math.round(volume).toLocaleString("en-US")} ${ctx.unit}`,
    effort,
  };
}

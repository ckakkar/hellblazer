import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getProgramProgress,
  PROGRAM_SELECT,
  type ProgramWithDays,
} from "@/lib/data/programs";
import { isValidTimeZone } from "@/lib/local-date";
import { fromDisplayWeight, toDisplayWeight, type Unit } from "@/lib/units";
import { STALE_CLOCK_MS } from "@/lib/workout-clock";
import { bearerToken, hashWatchToken } from "@/lib/watch/token";
import type {
  WatchExercise,
  WatchStartOption,
  WatchState,
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

async function resolve(db: Svc, request: Request): Promise<WatchContext | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const { data: link, error } = await db
    .from("watch_link")
    .select("id, user_id, last_seen_at")
    .eq("token_hash", hashWatchToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;
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
 * Runs one watch API call: 401 when the token is missing or was revoked
 * (the watch then asks the iPhone for a new one), 400 for a malformed body.
 */
export async function handleWatch(
  request: Request,
  run: (ctx: WatchContext) => Promise<unknown>,
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const db = createServiceClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers });
  try {
    const ctx = await resolve(db, request);
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

/** Everything the watch shows: the workout in progress and what it can start. */
export async function watchState(ctx: WatchContext): Promise<WatchState> {
  const [active, start] = await Promise.all([activeWorkout(ctx), startOptions(ctx)]);
  return { unit: ctx.unit, active, ...start };
}

/**
 * The newest unfinished session, like the resume banner's, but not one left
 * open for hours: that's a forgotten session, not a workout on the wrist.
 */
async function activeWorkout(ctx: WatchContext): Promise<WatchWorkout | null> {
  const { db, userId, unit } = ctx;
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
  const startedAt = Date.parse(session.created_at);
  if (Date.now() - startedAt > STALE_CLOCK_MS) return null;

  const [rows, targets] = await Promise.all([
    (async () => {
      const { data, error: rowsError } = await db
        .from("session_exercise")
        .select("id, exercise_id, position, exercise(name), set(id, set_number, weight_kg, reps, is_warmup)")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (rowsError) throw rowsError;
      return data ?? [];
    })(),
    (async () => {
      if (!session.template_id) return [];
      const { data, error: targetError } = await db
        .from("template_exercise")
        .select("position, target_sets, target_rep_range")
        .eq("template_id", session.template_id)
        .eq("user_id", userId);
      if (targetError) throw targetError;
      return data ?? [];
    })(),
  ]);

  // The previous session's working sets per movement, for copy-forward.
  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];
  const last = new Map<string, { weight: number; reps: number }[]>();
  if (exerciseIds.length > 0) {
    const { data, error: lastError } = await db.rpc("watch_last_performances", {
      p_user: userId,
      p_exercise_ids: exerciseIds,
      p_exclude_session: session.id,
    });
    if (lastError) throw lastError;
    for (const row of data ?? []) {
      const list = last.get(row.exercise_id) ?? [];
      list.push({ weight: toDisplayWeight(Number(row.weight_kg), unit), reps: row.reps });
      last.set(row.exercise_id, list);
    }
  }

  // Targets come from the template, matched by position as swaps keep it.
  const byPosition = new Map(targets.map((t) => [t.position, t]));
  const exercises: WatchExercise[] = rows.map((row) => {
    const target = byPosition.get(row.position);
    return {
      id: row.id,
      name: row.exercise?.name ?? "Exercise",
      targetSets: target?.target_sets ?? null,
      targetReps: target?.target_rep_range ?? null,
      sets: [...row.set]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          id: s.id,
          n: s.set_number,
          weight: toDisplayWeight(Number(s.weight_kg), unit),
          reps: s.reps,
          warmup: s.is_warmup,
        })),
      last: last.get(row.exercise_id) ?? [],
    };
  });

  return { id: session.id, title: session.title ?? "Workout", startedAt, exercises };
}

/** What /log offers: the active program's days, else every template. */
async function startOptions(
  ctx: WatchContext,
): Promise<{ next: WatchStartOption | null; options: WatchStartOption[] }> {
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
      !progress.isCompleted && progress.nextDay && nextTemplate
        ? {
            templateId: nextTemplate.id,
            programDayId: progress.nextDay.id,
            label: nextTemplate.day_label || nextTemplate.name,
            exercises: nextTemplate.template_exercise.length,
          }
        : null;
    return { next, options };
  }

  const { data: templates, error: templateError } = await db
    .from("workout_template")
    .select("id, name, day_label, template_exercise(id)")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (templateError) throw templateError;
  return {
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
});

/**
 * Starts a session from a template, through the same start_session() the web
 * uses (one transaction; as the service role, the user is passed in). A
 * second tap, or a start on the phone a moment ago, returns the session
 * already in progress instead of opening another.
 */
export async function startWatchWorkout(ctx: WatchContext, body: unknown): Promise<WatchState> {
  const v = startSchema.parse(body);
  if (await activeWorkout(ctx)) return watchState(ctx);
  const { error } = await ctx.db.rpc("start_session", {
    p_user: ctx.userId,
    ...(v.programDayId ? { p_program_day_id: v.programDayId } : { p_template_id: v.templateId }),
    p_date: v.localDate,
  });
  if (error) {
    // start_session raises "… not found" for a day or template that isn't theirs.
    throw error.code === "P0001" ? new WatchError(404, "not found") : error;
  }
  return watchState(ctx);
}

const setSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1).max(999),
  weight: z.number().min(0).max(9999),
  reps: z.number().int().min(0).max(9999),
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
    weight_kg: fromDisplayWeight(v.weight, unit),
    reps: v.reps,
    is_warmup: false,
    is_completed: true,
  };
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
    const { error: insertError } = await db.from("set").insert({ id: v.id, user_id: userId, ...row });
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
  return watchState(ctx);
}

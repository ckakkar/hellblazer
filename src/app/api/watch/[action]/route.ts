import {
  deleteWatchSet,
  finishWatchWorkout,
  handleWatch,
  saveWatchSet,
  startWatchWorkout,
  watchState,
} from "@/lib/watch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Apple Watch app's API (ios/App/Watch/WatchAPI.swift). Authenticated by
 * the watch's bearer token, not cookies, so the proxy doesn't run here.
 *
 *   GET  state        what the watch shows
 *   POST start        { templateId, programDayId, localDate }
 *   POST set          { id, sessionExerciseId, setNumber, weight, reps }
 *   POST delete-set   { id }
 *   POST finish       { sessionId, durationMin }
 */
export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "state") return Response.json({ error: "not found" }, { status: 404 });
  return handleWatch(request, watchState);
}

const writes = {
  start: startWatchWorkout,
  set: saveWatchSet,
  "delete-set": deleteWatchSet,
  finish: finishWatchWorkout,
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!Object.hasOwn(writes, action)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const run = writes[action as keyof typeof writes];
  const body: unknown = await request.json().catch(() => null);
  return handleWatch(request, (ctx) => run(ctx, body));
}

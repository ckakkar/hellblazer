import { handleWatch, logHeardSets, logVoiceSet, spokenWorkout } from "@/lib/watch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A set logged from the iPhone without opening the page: "Same again" and
 * "Log a set" to Siri, the Action button, the Control Center button
 * (ios/App/App/VoiceSetLogger.swift). Authenticated by the phone's device
 * token; unit and timezone come in the X-Fatty-* headers.
 *
 *   POST {}                 the next set, same numbers as the last
 *   POST { weight, reps }   a set with these numbers (display unit)
 *   POST { weight, reps, sessionExerciseId }
 *                           the set the Lock Screen showed, on its exercise
 *   POST { heard }          sets said in the lifter's own words, as the
 *                           phone's on-device model heard them (spoken-sets.ts)
 *   GET                     the workout's exercise names, for that model
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  if (body && typeof body === "object" && "heard" in body) {
    return handleWatch(request, (ctx) => logHeardSets(ctx, body), "phone");
  }
  return handleWatch(request, (ctx) => logVoiceSet(ctx, body), "phone");
}

export async function GET(request: Request) {
  return handleWatch(request, (ctx) => spokenWorkout(ctx), "phone");
}
